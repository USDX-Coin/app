"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field-error";
import { PAGE_HEADING_STICKY } from "@/components/shared/PageHeader";
import { KycStatusBanner } from "./KycStatusBanner";
import { KycCddFields } from "./KycCddFields";
import { KycCddTopUp } from "./KycCddTopUp";
import { KycSelect } from "./KycSelect";
import { useSession } from "@/hooks/useSession";
import { useKyc, type KycDocError, type KycDocState } from "@/hooks/useKyc";
import { useAuthStore } from "@/stores/authStore";
import { useLang } from "@/providers/LanguageProvider";
import { isEmailVerified } from "@/lib/auth/guards";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import type { PresignedDocKind } from "@/lib/api/types";
import {
  EMPTY_CDD_FORM,
  toCddPayload,
  validateCdd,
  type CddErrorField,
  type CddFormState,
} from "@/lib/kyc/cdd";
import {
  EMPTY_IDENTITY_FORM,
  IDENTITY_OPTIONS,
  identityDocLabelKey,
  identityNumberErrorKey,
  identityNumberLabelKey,
  identityNumberPlaceholderKey,
  identityOptionLabelKey,
  selfieDocLabelKey,
  toIdentityPayload,
  validateIdentity,
  type IdentityFormState,
  type IdentityType,
} from "@/lib/kyc/identity";
import { kycFormMode } from "@/lib/kyc/form-mode";
import { toast } from "sonner";

// /kyc (USDX-152): banner status per keadaan, unggah presigned per berkas dengan
// pratinjau + loading, submit mati sampai setiap field dan kedua foto masuk,
// REJECTED → "Submit Ulang" mengaktifkan lagi formnya (resubmit tak terbatas per
// sot/phase-2/week1.md § Status Flow).
//
// USDX-545 menambahkan blok CDD sebagai SATU BAGIAN dari form satu langkah ini.
//
// USDX-586 melengkapi form ke Pasal 25 ayat (1) huruf a POJK 8/2023: bagian
// identitas mendapat `nationality`, `gender`, `maritalStatus`, `mothersMaidenName`
// (wajib) dan `aliasName` (opsional), `identityType` jadi bisa dipilih (KTP /
// paspor, Pasal 26 ayat (2)), dan blok CDD mendapat `netWorthRange`,
// `employerAddress`, `employerPhone`, serta `sourceOfWealth`. Sebelum ini backend
// sudah mewajibkan sembilan field itu, jadi setiap submit dari app dijawab
// 422 VALIDATION_ERROR — form ini yang tertinggal, bukan kontraknya.
//
// RESOLVED 27 Agu 2026 (Wisnu): nasabah yang SUDAH VERIFIED tapi belum punya CDD
// diberi tahu dan boleh melengkapinya — tidak digate saat transaksi, tidak pula
// dibiarkan. Mereka mendapat `KycCddTopUp`: hanya field CDD, dikirim lewat endpoint
// terpisah yang membiarkan status VERIFIED apa adanya. Form mana (kalau ada) yang
// dilihat seorang nasabah diputuskan `lib/kyc/form-mode.ts` — aturan "VERIFIED tidak
// pernah mendapat form penuh" itu menanggung beban, karena submit form penuh
// mengembalikan status ke PENDING.
//
// Lima field identitas baru USDX-586 TIDAK bisa dilengkapi lewat `KycCddTopUp`:
// kontraknya menaruhnya di bagian identitas `SubmitKycRequest`, bukan di
// `KycCddFields`, dan `PATCH /api/v2/kyc/cdd` sengaja tidak berkuasa mengubah data
// identitas yang sudah disetujui. kyc.yaml mencatat itu sebagai lubang yang sudah
// diketahui dengan jalur penyelesaian di tangan PM (pengkinian data berkala
// Pasal 51), bukan sesuatu yang ditambal diam-diam dari sisi app.
export function KycPageContent() {
  useSession(); // refresh user (emailVerifiedAt / kycStatus) dari /api/v2/auth/me
  const user = useAuthStore((s) => s.user);
  const { t } = useLang();
  const {
    status,
    statusLoading,
    refreshStatus,
    docs,
    selectDoc,
    clearUploads,
    uploadsReady,
    uploadsBusy,
    submit,
    submitting,
    submitCdd,
    submittingCdd,
  } = useKyc();

  const [form, setForm] = useState<IdentityFormState>(EMPTY_IDENTITY_FORM);
  // Separuh CDD dari form yang sama. Objek state terpisah karena tipe nilainya
  // sendiri (enum + boolean), bukan sekadar string.
  const [cdd, setCdd] = useState<CddFormState>(EMPTY_CDD_FORM);
  // Nasabah sudah pernah menekan submit. Sebelum itu form diam saja; sesudahnya
  // pesan error dihitung ulang tiap render, supaya pesan yang sudah diperbaiki
  // langsung hilang dan tombolnya hidup lagi.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Nomor identitas yang DITOLAK backend (400 `KYC_IDENTITY_NUMBER_INVALID`).
  // Disimpan sebagai NILAINYA, bukan sebagai pesan: dengan begitu pesannya hilang
  // sendiri begitu nasabah mengetik nomor lain, tanpa jalur pembersihan tersendiri
  // yang bisa lupa dijalankan.
  const [rejectedIdentityNumber, setRejectedIdentityNumber] = useState<string | null>(null);
  // Keadaan REJECTED hanya merender banner sampai nasabah memilih mengajukan ulang.
  const [resubmitting, setResubmitting] = useState(false);

  const [gateBefore, gateAfter] = t("kyc.gate.body").split("{link}");

  // Kedua setter memakai updater fungsional, BUKAN `{ ...form, [key]: value }` dari
  // closure. Bukan gaya penulisan: checkbox PEP memanggil `onChange` tiga kali dalam
  // satu event (pepStatus + dua field yang ditarik kembali), dan versi closure akan
  // membuat panggilan kedua menulis ulang state hasil panggilan pertama — centangnya
  // seolah tidak pernah berubah.
  function setField<K extends keyof IdentityFormState>(key: K, value: IdentityFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setCddField<K extends keyof CddFormState>(key: K, value: CddFormState[K]) {
    setCdd((prev) => ({ ...prev, [key]: value }));
  }

  // Setiap kunci CDD dipetakan ke pesannya SENDIRI yang menyebut field itu
  // ("Pekerjaan wajib dipilih"), tidak pernah satu "lengkapi form" yang generik —
  // AC USDX-545/USDX-586. Dipakai kedua jalur submit supaya keduanya tidak mungkin
  // berbeda pendapat soal apa yang wajib.
  function cddErrorMessages(source: CddFormState): Record<CddErrorField, string | undefined> {
    const cddErrors = validateCdd(source);
    return {
      occupation: cddErrors.occupation && t(cddErrors.occupation),
      sourceOfFunds: cddErrors.sourceOfFunds && t(cddErrors.sourceOfFunds),
      annualIncomeRange: cddErrors.annualIncomeRange && t(cddErrors.annualIncomeRange),
      netWorthRange: cddErrors.netWorthRange && t(cddErrors.netWorthRange),
      transactionPurpose: cddErrors.transactionPurpose && t(cddErrors.transactionPurpose),
      sourceOfWealth: cddErrors.sourceOfWealth && t(cddErrors.sourceOfWealth),
      pepRelation: cddErrors.pepRelation && t(cddErrors.pepRelation),
    };
  }

  // Identitas + CDD + kedua foto, sebagai satu peta field → pesan. `identityNumber`
  // sengaja lewat `validateIdentity`, bukan pola 16 digit yang ditulis di sini:
  // aturannya berbeda untuk paspor (Pasal 26 ayat (2)), dan aturan itu hanya boleh
  // hidup di satu tempat.
  function fullFormErrors(
    identity: IdentityFormState,
    cddForm: CddFormState,
  ): Record<string, string | undefined> {
    const identityErrors = validateIdentity(identity);
    return {
      ...Object.fromEntries(
        Object.entries(identityErrors).map(([field, key]) => [field, t(key)]),
      ),
      ktp: docs.ktp.objectKey ? undefined : t("kyc.err.ktp"),
      selfie: docs.selfie.objectKey ? undefined : t("kyc.err.selfie"),
      ...cddErrorMessages(cddForm),
    };
  }

  // Top-up CDD saja (nasabah yang sudah VERIFIED). Memanggil `submitCdd`, TIDAK
  // PERNAH `submit` — yang terakhir akan mengembalikan nasabah terverifikasi ke
  // PENDING.
  async function handleCddTopUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (Object.values(cddErrorMessages(cdd)).some(Boolean)) return;

    try {
      await submitCdd(toCddPayload(cdd));
      setCdd(EMPTY_CDD_FORM);
      setSubmitAttempted(false);
      toast.success(t("kyc.cdd.topup.saved"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("kyc.cdd.topup.failed")));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (Object.values(fullFormErrors(form, cdd)).some(Boolean)) return;

    try {
      await submit({
        // Kedua payload dibangun builder-nya masing-masing, bukan disusun ulang di
        // sini: hanya `toIdentityPayload`/`toCddPayload` yang boleh memutuskan kunci
        // wire dan normalisasi `null`-nya.
        identity: toIdentityPayload(form),
        cdd: toCddPayload(cdd),
      });
      setResubmitting(false);
      setForm(EMPTY_IDENTITY_FORM);
      setCdd(EMPTY_CDD_FORM);
      setSubmitAttempted(false);
      setRejectedIdentityNumber(null);
      clearUploads();
      toast.success(t("kyc.submitted"));
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "KYC_IDENTITY_NUMBER_INVALID") {
          // Backend menolak nomor yang lolos aturan lokal (mis. NIK 16 digit yang
          // tidak terdaftar). Tandai nomornya, bukan pesannya — lihat state-nya.
          setRejectedIdentityNumber(form.identityNumber);
          return;
        }
        if (err.code === "KYC_FILE_NOT_FOUND" || err.code === "KYC_FILE_INVALID") {
          clearUploads();
          toast.error(t("kyc.err.uploadFailed"));
          return;
        }
        if (err.status === 409) {
          // Balapan: sudah PENDING / VERIFIED (mis. dari tab lain) — sinkronkan banner.
          refreshStatus();
          return;
        }
      }
      toast.error(getErrorMessage(err, t("kyc.failed")));
    }
  }

  // requireEmailVerified — user Phase 1 bermigrasi lewat Forgot password.
  if (user && !isEmailVerified(user)) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <h1 className={cn(PAGE_HEADING_STICKY, "text-2xl font-semibold text-foreground")}>
          {t("kyc.title")}
        </h1>
        <div
          role="alert"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {gateBefore}
          <Link href="/forgot-password" className="font-medium underline underline-offset-2">
            {t("kyc.gate.link")}
          </Link>
          {gateAfter}
        </div>
      </div>
    );
  }

  if (statusLoading || !status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  // Tampilnya form per keadaan (USDX-152 + USDX-545): UNVERIFIED aktif; PENDING
  // terlihat tapi mati; REJECTED tersembunyi sampai "Submit Ulang"; VERIFIED
  // mendapat top-up CDD selama CDD-nya belum ada, dan tidak apa-apa setelah lengkap.
  const formDisabled = status.status === "PENDING" || submitting;
  const formMode = kycFormMode(status, resubmitting);
  const showForm = formMode === "full";

  // Pesan error DITURUNKAN dari state form tiap render, bukan disimpan. Menyimpannya
  // berarti menyalin state form ke tempat kedua yang bisa basi — dan pesan yang sudah
  // diperbaiki nasabah akan bertahan di layar sampai submit berikutnya.
  const errors: Record<string, string | undefined> = submitAttempted
    ? formMode === "cdd-only"
      ? cddErrorMessages(cdd)
      : fullFormErrors(form, cdd)
    : {};
  if (!errors.identityNumber && rejectedIdentityNumber === form.identityNumber) {
    errors.identityNumber = t(identityNumberErrorKey(form.identityType));
  }
  const hasErrors = Object.values(errors).some(Boolean);

  // Tidak berubah sejak USDX-152: blok identitas dasar + kedua foto menggerbangi
  // tombol. Field WAJIB BARU (kewarganegaraan, jenis kelamin, status perkawinan,
  // nama gadis ibu kandung, net worth, sumber kekayaan) sengaja TIDAK ikut di sini —
  // tombol mati hanya bisa berkata "ada yang kurang", sedangkan tiket menuntut pesan
  // yang MENYEBUT field-nya. Karena itu field baru diperiksa saat submit, tempat ia
  // bisa memunculkan satu pesan per field; setelah percobaan submit pertama,
  // `hasErrors` di bawah yang mematikan tombolnya sampai semuanya diperbaiki.
  const allFilled =
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.dob !== "" &&
    form.birthPlace.trim() !== "" &&
    form.identityNumber.trim() !== "" &&
    form.addressLine1.trim() !== "" &&
    uploadsReady;

  return (
    // `w-full`: item flex dari pembungkus scroll dashboard — `mx-auto` membatalkan
    // stretch default, tanpa ini kolomnya menyusut selebar isinya.
    <div className="mx-auto w-full max-w-xl space-y-6">
      {/* Sticky supaya form KYC yang panjang menggulir di bawah judulnya sendiri. */}
      <div className={PAGE_HEADING_STICKY}>
        <h1 className="text-2xl font-semibold text-foreground">{t("kyc.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("kyc.subtitle")}</p>
      </div>

      <KycStatusBanner
        status={status}
        onResubmit={() => setResubmitting(true)}
        resubmitActive={resubmitting}
      />

      {formMode === "cdd-only" && (
        <KycCddTopUp
          form={cdd}
          errors={errors}
          onChange={setCddField}
          onSubmit={handleCddTopUpSubmit}
          submitting={submittingCdd}
        />
      )}

      {showForm && (
        <form onSubmit={handleSubmit}>
          <fieldset disabled={formDisabled} className="space-y-4 disabled:opacity-60">
            {/* Judul bagian identitas — pasangan judul blok CDD di bawah. Formnya
                panjang sejak USDX-586, dan dua kelompok bernama membuatnya terbaca
                sebagai dua pertanyaan, bukan satu borang. */}
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("kyc.identity.sectionTitle")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("kyc.identity.sectionHint")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">{t("kyc.firstName")}</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.firstName}
                />
                <FieldError message={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName">{t("kyc.lastName")}</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.lastName}
                />
                <FieldError message={errors.lastName} />
              </div>
            </div>

            {/* Alias — "nama lengkap termasuk nama alias, JIKA ADA" (butir a). Kosong
                adalah jawaban lengkap, bukan pengajuan yang kurang, jadi tidak pernah
                divalidasi dan labelnya menyebut opsional. */}
            <div>
              <Label htmlFor="aliasName">{t("kyc.aliasName")}</Label>
              <Input
                id="aliasName"
                autoComplete="off"
                placeholder={t("kyc.aliasNamePh")}
                value={form.aliasName}
                onChange={(e) => setField("aliasName", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dob">{t("kyc.dob")}</Label>
                <Input
                  id="dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setField("dob", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.dob}
                />
                <FieldError message={errors.dob} />
              </div>
              <div>
                <Label htmlFor="birthPlace">{t("kyc.birthPlace")}</Label>
                <Input
                  id="birthPlace"
                  value={form.birthPlace}
                  onChange={(e) => setField("birthPlace", e.target.value)}
                  className="mt-1.5"
                  aria-invalid={!!errors.birthPlace}
                />
                <FieldError message={errors.birthPlace} />
              </div>
              <KycSelect
                id="gender"
                label={t("kyc.gender")}
                value={form.gender}
                options={IDENTITY_OPTIONS.gender}
                labelKey={(v) => identityOptionLabelKey("gender", v)}
                error={errors.gender}
                onChange={(v) => setField("gender", v as IdentityFormState["gender"])}
              />
              <KycSelect
                id="maritalStatus"
                label={t("kyc.maritalStatus")}
                value={form.maritalStatus}
                options={IDENTITY_OPTIONS.maritalStatus}
                labelKey={(v) => identityOptionLabelKey("maritalStatus", v)}
                error={errors.maritalStatus}
                onChange={(v) =>
                  setField("maritalStatus", v as IdentityFormState["maritalStatus"])
                }
              />
            </div>

            {/* Nama gadis ibu kandung — butir j), wajib dan tanpa kualifikasi "jika
                ada". PII yang perlakuannya lebih ketat daripada nama biasa: di banyak
                layanan keuangan Indonesia ia masih dipakai sebagai jawaban verifikasi
                lewat telepon, jadi jangan pernah dipakai sebagai faktor autentikasi
                di sistem kita sendiri dan jangan pernah dikembalikan ke app. */}
            <div>
              <Label htmlFor="mothersMaidenName">{t("kyc.mothersMaidenName")}</Label>
              <Input
                id="mothersMaidenName"
                autoComplete="off"
                placeholder={t("kyc.mothersMaidenNamePh")}
                value={form.mothersMaidenName}
                onChange={(e) => setField("mothersMaidenName", e.target.value)}
                className="mt-1.5"
                aria-invalid={!!errors.mothersMaidenName}
              />
              <FieldError message={errors.mothersMaidenName} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Jenis identitas kini bisa dipilih (Pasal 26 ayat (2)): KTP untuk WNI,
                  paspor untuk WNA. Mengubahnya ikut mengubah label, placeholder, dan
                  aturan panjang nomor identitas di bawah. */}
              <KycSelect
                id="identityType"
                label={t("kyc.identityType")}
                value={form.identityType}
                options={IDENTITY_OPTIONS.identityType}
                labelKey={(v) => identityOptionLabelKey("identityType", v)}
                onChange={(v) => setField("identityType", v as IdentityType)}
              />
              {/* Kewarganegaraan — butir e), dan BUKAN duplikat `country` di bawah:
                  `country` adalah negara alamat tinggal, ini kewarganegaraan orangnya.
                  WNI yang tinggal di Singapura punya nationality ID dan country SG.
                  Kotak teks dua huruf, bukan daftar negara: kontraknya meminta kode
                  ISO 3166-1 alpha-2 dan repo ini belum punya daftar negara — mengarang
                  daftarnya di form kepatuhan justru masalah yang tiket ini perbaiki. */}
              <div>
                <Label htmlFor="nationality">{t("kyc.nationality")}</Label>
                <Input
                  id="nationality"
                  autoComplete="off"
                  maxLength={2}
                  placeholder={t("kyc.nationalityPh")}
                  value={form.nationality}
                  onChange={(e) => setField("nationality", e.target.value.toUpperCase())}
                  className="mt-1.5 uppercase"
                  aria-invalid={!!errors.nationality}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("kyc.nationalityHint")}</p>
                <FieldError message={errors.nationality} />
              </div>
            </div>

            <div>
              <Label htmlFor="country">{t("kyc.country")}</Label>
              <Input
                id="country"
                value="ID"
                readOnly
                aria-readonly="true"
                className="mt-1.5 bg-muted/50 text-muted-foreground"
              />
            </div>

            <div>
              <Label htmlFor="identityNumber">
                {t(identityNumberLabelKey(form.identityType))}
              </Label>
              <Input
                id="identityNumber"
                // Paspor alfanumerik — memaksa keypad angka di sana akan menyembunyikan
                // huruf yang justru dibutuhkan.
                inputMode={form.identityType === "KTP" ? "numeric" : "text"}
                placeholder={t(identityNumberPlaceholderKey(form.identityType))}
                value={form.identityNumber}
                onChange={(e) => setField("identityNumber", e.target.value)}
                className="mt-1.5"
                aria-invalid={!!errors.identityNumber}
              />
              <FieldError message={errors.identityNumber} />
            </div>

            <div>
              <Label htmlFor="addressLine1">{t("kyc.address1")}</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1}
                onChange={(e) => setField("addressLine1", e.target.value)}
                className="mt-1.5"
                aria-invalid={!!errors.addressLine1}
              />
              <FieldError message={errors.addressLine1} />
            </div>

            <div>
              <Label htmlFor="addressLine2">{t("kyc.address2")}</Label>
              <Input
                id="addressLine2"
                value={form.addressLine2}
                onChange={(e) => setField("addressLine2", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <KycCddFields form={cdd} errors={errors} onChange={setCddField} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DocField
                kind="ktp"
                label={t(identityDocLabelKey(form.identityType))}
                doc={docs.ktp}
                requiredError={errors.ktp}
                onSelect={selectDoc}
              />
              <DocField
                kind="selfie"
                label={t(selfieDocLabelKey(form.identityType))}
                doc={docs.selfie}
                requiredError={errors.selfie}
                onSelect={selectDoc}
              />
            </div>

            <Button
              type="submit"
              disabled={!allFilled || uploadsBusy || submitting || formDisabled || hasErrors}
              className="w-full brand-gradient text-white"
            >
              {submitting
                ? t("kyc.submitting")
                : status.status === "REJECTED"
                  ? t("kyc.resubmit")
                  : t("kyc.submit")}
            </Button>
          </fieldset>
        </form>
      )}
    </div>
  );
}

// Satu pesan per keadaan error dokumen. Ditulis sebagai peta, bukan rantai ternary,
// supaya TypeScript memaksa setiap keadaan baru di `KycDocError` punya pesannya
// sendiri — keadaan yang lupa dipetakan dulu diam-diam ikut memakai pesan "unggah
// ulang", yang justru salah untuk kegagalan sisi server.
const DOC_ERROR_MESSAGE_KEY: Record<NonNullable<KycDocError>, string> = {
  type: "kyc.err.fileType",
  size: "kyc.err.fileTooLarge",
  upload: "kyc.err.uploadFailed",
  server: "kyc.err.uploadServer",
  network: "kyc.err.uploadNetwork",
};

function DocField({
  kind,
  label,
  doc,
  requiredError,
  onSelect,
}: {
  kind: PresignedDocKind;
  label: string;
  doc: KycDocState;
  requiredError?: string;
  onSelect: (kind: PresignedDocKind, file: File | null) => void;
}) {
  const { t } = useLang();
  const docError = doc.error ? t(DOC_ERROR_MESSAGE_KEY[doc.error]) : undefined;

  const showPreview = !!doc.previewUrl && !doc.error;

  return (
    <div>
      <Label htmlFor={`${kind}File`}>{label}</Label>
      {/* Satu kartu dropzone per dokumen: placeholder selagi kosong, fotonya begitu
          dipilih. Mengklik kartu membuka (lagi) pemilih berkas — bukan baris input +
          pratinjau terpisah. Input aslinya tetap ada di DOM (sr-only) supaya test dan
          teknologi bantu tetap menyasar #ktpFile / #selfieFile. */}
      <label
        htmlFor={`${kind}File`}
        className={cn(
          "mt-1.5 flex h-48 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/70 hover:bg-muted",
          showPreview && "border-solid border-border",
          (docError ?? requiredError) && "border-destructive",
        )}
      >
        {showPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.previewUrl ?? undefined}
            alt={label}
            className="size-full object-cover"
            onError={(e) => {
              // Pratinjau HEIC tidak bisa dirender kebanyakan browser — sembunyikan
              // dengan anggun; baris status di bawah tetap menegaskan keadaan unggahan.
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-8 opacity-70" />
            <span className="font-medium">{t("kyc.uploadPlaceholder")}</span>
            <span className="text-xs opacity-75">{t("kyc.uploadHint")}</span>
          </span>
        )}
      </label>
      <input
        id={`${kind}File`}
        type="file"
        accept="image/jpeg,image/png,image/heic"
        onChange={(e) => onSelect(kind, e.target.files?.[0] ?? null)}
        className="sr-only"
        aria-invalid={!!(docError ?? requiredError)}
      />
      {doc.uploading && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t("kyc.uploading")}
        </p>
      )}
      {doc.objectKey && !doc.uploading && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" /> {t("kyc.uploaded")}
          <span className="text-muted-foreground">· {t("kyc.changePhoto")}</span>
        </p>
      )}
      <FieldError message={docError ?? requiredError} />
    </div>
  );
}
