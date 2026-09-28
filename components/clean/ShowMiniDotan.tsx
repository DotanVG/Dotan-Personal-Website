"use client";

export function ShowMiniDotan() {
  return (
    <button
      data-show-mini-dotan
      type="button"
      className="min-h-11 text-sm underline underline-offset-4"
      onClick={() => window.dispatchEvent(new Event("mini-dotan-show"))}
    >
      Show Mini Dotan
    </button>
  );
}
