import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToasts } from './useToasts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('toast', () => {
  it('hiện thông báo vừa thêm', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push('success', 'Đã lưu');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toBe('Đã lưu');
    expect(result.current.toasts[0]?.kind).toBe('success');
  });

  it('tự tắt sau 3,5 giây', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push('success', 'Đã lưu');
    });
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('thông báo lỗi ở lâu hơn để kịp đọc', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push('error', 'Hỏng rồi');
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('chạm vào là tắt ngay', () => {
    const { result } = renderHook(() => useToasts());
    let id = 0;
    act(() => {
      id = result.current.push('info', 'Đang tải');
    });
    act(() => {
      result.current.dismiss(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('nhiều nhất 3 cái cùng lúc, cái cũ nhất bị đẩy ra', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      ['một', 'hai', 'ba', 'bốn'].forEach((m) => result.current.push('info', m));
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(['hai', 'ba', 'bốn']);
  });

  it('mỗi thông báo có id riêng', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push('info', 'a');
      result.current.push('info', 'b');
    });
    const ids = result.current.toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
