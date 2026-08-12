import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCooldown, DEFAULT_COOLDOWN_SECONDS } from "@/hooks/useCooldown";

describe("useCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("positive", () => {
    test("starts inactive at 0", () => {
      const { result } = renderHook(() => useCooldown());
      expect(result.current.remaining).toBe(0);
      expect(result.current.active).toBe(false);
    });

    test("ticks down one second at a time after start", () => {
      const { result } = renderHook(() => useCooldown());
      act(() => result.current.start(3));
      expect(result.current.remaining).toBe(3);
      expect(result.current.active).toBe(true);

      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(2);

      act(() => vi.advanceTimersByTime(1000));
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(0);
      expect(result.current.active).toBe(false);
    });
  });

  describe("positive — long cooldowns (USDX-167)", () => {
    test("hour-scale cooldown steps to the previous hour boundary, not per second", () => {
      const { result } = renderHook(() => useCooldown());
      act(() => result.current.start(76451)); // 21h14m — forgot-password daily limit

      // One second in, nothing has changed: the timer sleeps until the next
      // display change (75600 = 21h exact), not a 1s tick.
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(76451);

      act(() => vi.advanceTimersByTime(850 * 1000));
      expect(result.current.remaining).toBe(75600);

      act(() => vi.advanceTimersByTime(3600 * 1000));
      expect(result.current.remaining).toBe(72000);
    });

    test("minute-scale cooldown steps to minute boundaries, then per second under 60", () => {
      const { result } = renderHook(() => useCooldown());
      act(() => result.current.start(300));

      act(() => vi.advanceTimersByTime(60 * 1000));
      expect(result.current.remaining).toBe(240);

      act(() => vi.advanceTimersByTime(60 * 1000));
      act(() => vi.advanceTimersByTime(60 * 1000));
      act(() => vi.advanceTimersByTime(60 * 1000));
      expect(result.current.remaining).toBe(60);

      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(59);
    });
  });

  describe("edge cases", () => {
    test("restarting mid-count resets the remaining time", () => {
      const { result } = renderHook(() => useCooldown());
      act(() => result.current.start(5));
      act(() => vi.advanceTimersByTime(1000));
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(3);

      act(() => result.current.start(10));
      expect(result.current.remaining).toBe(10);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(9);
    });

    test("does not go below zero", () => {
      const { result } = renderHook(() => useCooldown());
      act(() => result.current.start(1));
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.remaining).toBe(0);
      act(() => vi.advanceTimersByTime(5000));
      expect(result.current.remaining).toBe(0);
      expect(result.current.active).toBe(false);
    });

    test("default fallback is 60 seconds", () => {
      expect(DEFAULT_COOLDOWN_SECONDS).toBe(60);
    });
  });
});
