import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldHelp } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardContent, CardRow } from "@/components/ui/card";
import { CardChoice } from "@/components/ui/card-choice";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox, CheckboxField } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { LinkInline } from "@/components/ui/link-inline";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MenuProfil } from "@/components/ui/menu-profil";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function wrap(ui: React.ReactNode) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

/**
 * Standards guard for `components/ui/`.
 *
 * The three assertions in the middle are the ones the design brief calls
 * mandatory, each named after the Figma bug it stops from being reborn:
 * a value that survives every visual state (C-1), a help line that collapses to
 * nothing (C-2), and an alert that does not reserve room for an action it is
 * not showing (C-3). The rest is a render smoke test — every component here is
 * new or rewritten, and most have no caller yet, so nothing else would catch a
 * component that throws on mount.
 */
describe("components/ui standards", () => {
  it("renders every control variant", () => {
    wrap(
      <>
        <Button>Kirim</Button>
        <Button variant="outline" size="lg" loading loadingLabel="Memproses…">Konfirmasi</Button>
        <Button variant="ghost" comingSoon>Bridge</Button>
        <Button variant="destructive" cooldownSeconds={5} cooldownLabel="Coba lagi 5 detik">Keluar</Button>
        <Button variant="link">Lupa kata sandi?</Button>
        <LinkInline href="#">Buat akun</LinkInline>
        <Input id="a" defaultValue="12345" />
        <Spinner />
      </>
    );
    expect(screen.getByText("Kirim")).toBeTruthy();
    expect(screen.getByText("Memproses…")).toBeTruthy();
  });

  it("collapses the field help line when empty", () => {
    const { container } = wrap(
      <Field>
        <FieldLabel htmlFor="b" optional>Nama</FieldLabel>
        <Input id="b" />
        <FieldHelp id="b" />
      </Field>
    );
    expect(container.querySelector("[data-slot=field-help]")).toBeTruthy();
    expect(container.querySelector("[data-slot=field-error]")).toBeNull();
    expect(container.querySelector("[data-slot=field-description]")).toBeNull();
  });

  it("keeps the input value across visual states", () => {
    const states = [{}, { disabled: true }, { readOnly: true }, { "aria-invalid": true }] as const;
    for (const s of states) {
      const { container, unmount } = wrap(<Input defaultValue="12345" {...s} />);
      expect((container.querySelector("input") as HTMLInputElement).value).toBe("12345");
      expect(container.querySelectorAll("input").length).toBe(1);
      unmount();
    }
  });

  it("omits the alert action frame when there is no action", () => {
    const { container } = wrap(<Alert tone="warning" title="Data lama">Coba lagi.</Alert>);
    expect(container.querySelector("[data-slot=alert]")?.children.length).toBe(2);
  });

  it("renders surfaces and data components", () => {
    wrap(
      <>
        <Badge tone="success">Selesai</Badge>
        <StatusBadge status="WAITING_FOR_PAYMENT">Menunggu</StatusBadge>
        <Card><CardHeader><CardTitle>Ringkasan</CardTitle></CardHeader><CardContent><CardRow label="Total">Rp 1</CardRow></CardContent></Card>
        <RadioGroup defaultValue="a">
          <CardChoice value="a" title="Perorangan" description="KTP" />
          <CardChoice value="b" title="Badan Usaha" badge="Segera hadir" disabled />
        </RadioGroup>
        <CheckboxField htmlFor="c"><Checkbox id="c" /> Saya setuju</CheckboxField>
        <Empty><EmptyHeader><EmptyMedia kind="empty" /><EmptyTitle>Belum ada transaksi</EmptyTitle></EmptyHeader><EmptyContent><Button>Mint</Button></EmptyContent></Empty>
        <Skeleton shape="circle" className="size-10" />
        <SkeletonText />
        <PasswordStrength score={3} label="Sedang" />
        <NativeSelect defaultValue="x"><NativeSelectOption value="x">X</NativeSelectOption></NativeSelect>
        <InputGroup><InputGroupAddon><InputGroupButton>Maks</InputGroupButton></InputGroupAddon><InputGroupInput /></InputGroup>
        <Table density="compact"><TableHeader><TableRow><TableHead>Tanggal</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>1 Sep</TableCell></TableRow></TableBody></Table>
        <Pagination><PaginationContent><PaginationItem><PaginationLink isActive>1</PaginationLink></PaginationItem></PaginationContent></Pagination>
        <ToggleGroup type="single" defaultValue="c"><ToggleGroupItem value="c">Rapat</ToggleGroupItem></ToggleGroup>
      </>
    );
    expect(screen.getByText("Selesai")).toBeTruthy();
    expect(screen.getByText("Badan Usaha")).toBeTruthy();
  });


  /**
   * Arrow keys must move the CHOICE, not just the focus (WAI-ARIA radio
   * pattern). Radix intends this but learns "an arrow is down" from a
   * `document` keydown listener that React's delegated events beat to the
   * punch, so out of the box the arrows only moved focus — and with a maroon
   * focus ring on a maroon-selected control, a keyboard user could arrow onto
   * another bank, see a ring, and pay the wrong account.
   */
  describe("RadioGroup keyboard", () => {
    const renderGroup = () =>
      wrap(
        <RadioGroup defaultValue="BCA" aria-label="Bank">
          {["BCA", "BNI", "MANDIRI"].map((b) => (
            <RadioGroupItem key={b} value={b} aria-label={b} />
          ))}
        </RadioGroup>
      );
    const checked = () =>
      screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"));

    it("moves the selection with ArrowDown, not just the focus", () => {
      renderGroup();
      const [bca, bni] = screen.getAllByRole("radio");
      bca.focus();
      fireEvent.keyDown(bca, { key: "ArrowDown" });
      expect(document.activeElement).toBe(bni);
      expect(checked()).toEqual(["false", "true", "false"]);
    });

    it("moves backwards and wraps with ArrowUp", () => {
      renderGroup();
      const [bca, , mandiri] = screen.getAllByRole("radio");
      bca.focus();
      fireEvent.keyDown(bca, { key: "ArrowUp" });
      expect(document.activeElement).toBe(mandiri);
      expect(checked()).toEqual(["false", "false", "true"]);
    });

    it("treats ArrowRight/ArrowLeft the same as Down/Up", () => {
      renderGroup();
      const [bca, bni] = screen.getAllByRole("radio");
      bca.focus();
      fireEvent.keyDown(bca, { key: "ArrowRight" });
      expect(checked()).toEqual(["false", "true", "false"]);
      fireEvent.keyDown(bni, { key: "ArrowLeft" });
      expect(checked()).toEqual(["true", "false", "false"]);
    });

    it("does NOT select when focus arrives any other way", () => {
      renderGroup();
      const [, , mandiri] = screen.getAllByRole("radio");
      mandiri.focus();
      expect(checked()).toEqual(["true", "false", "false"]);
    });

    it("keeps Space and click working", () => {
      renderGroup();
      const [, bni, mandiri] = screen.getAllByRole("radio");
      mandiri.focus();
      fireEvent.click(mandiri);
      expect(checked()).toEqual(["false", "false", "true"]);
      fireEvent.click(bni);
      expect(checked()).toEqual(["false", "true", "false"]);
    });

    it("skips disabled options", () => {
      wrap(
        <RadioGroup defaultValue="A" aria-label="G">
          <RadioGroupItem value="A" aria-label="A" />
          <RadioGroupItem value="B" aria-label="B" disabled />
          <RadioGroupItem value="C" aria-label="C" />
        </RadioGroup>
      );
      const [a, , c] = screen.getAllByRole("radio");
      a.focus();
      fireEvent.keyDown(a, { key: "ArrowDown" });
      expect(document.activeElement).toBe(c);
      expect(c.getAttribute("aria-checked")).toBe("true");
    });
  });

  it("renders overlays open", () => {
    wrap(
      <>
        <Dialog defaultOpen>
          <DialogContent size="lg">
            <DialogHeader><DialogTitle>Ringkasan transaksi</DialogTitle></DialogHeader>
            <DialogBody>Isi</DialogBody>
            <DialogFooter><Button size="lg">Konfirmasi</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet defaultOpen>
          <SheetContent side="left">
            <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
            <SheetBody>Nav</SheetBody>
            <SheetFooter>Tema</SheetFooter>
          </SheetContent>
        </Sheet>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Akun</DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuItem tone="destructive">Keluar</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </>
    );
    expect(screen.getByText("Ringkasan transaksi")).toBeTruthy();
    expect(screen.getAllByLabelText("Tutup").length).toBeGreaterThan(0);
    expect(screen.getByText("Keluar")).toBeTruthy();
  });

  it("renders tabs, select trigger, tooltip and the profile menu", () => {
    wrap(
      <>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="mint">Mint</TabsTrigger>
          </TabsList>
          <TabsContents><TabsContent value="all">Daftar</TabsContent></TabsContents>
        </Tabs>
        <Select><SelectTrigger size="md"><SelectValue placeholder="Pilih bank" /></SelectTrigger><SelectContent><SelectItem value="bca">BCA</SelectItem></SelectContent></Select>
        <Tooltip><TooltipTrigger>i</TooltipTrigger><TooltipContent>Salin hash</TooltipContent></Tooltip>
        <MenuProfil
          name="Wisnu Barata" email="w@usdx.id" kycStatus="UNVERIFIED"
          lang="id" onLangChange={() => {}} theme="light" onThemeChange={() => {}}
          languages={[{ value: "id", label: "Indonesia" }]}
          themes={[{ value: "light", label: "Terang" }]}
          onProfile={() => {}} onSettings={() => {}} onVerify={() => {}} onLogout={() => {}}
        />
      </>
    );
    expect(screen.getByText("Semua")).toBeTruthy();
    expect(screen.getByText("Pilih bank")).toBeTruthy();
    expect(screen.getByText("Wisnu Barata")).toBeTruthy();
  });
});
