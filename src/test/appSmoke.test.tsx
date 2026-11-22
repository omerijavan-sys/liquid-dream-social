import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import App from "@/App";

// Guards against the "blank screen" class of bugs: the whole app must mount without throwing.
describe("app smoke test", () => {
  it("mounts the full app without crashing", async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a); });
    const { container } = render(<ErrorBoundary><App /></ErrorBoundary>);
    await waitFor(() => expect(container.innerHTML.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 300));
    spy.mockRestore();
    expect(container.textContent).not.toContain("Something went wrong");
    const crash = errors.find((e) => String((e as unknown[])[0]).includes("App crashed"));
    expect(crash, String(crash)).toBeUndefined();
  });
});
