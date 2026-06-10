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
