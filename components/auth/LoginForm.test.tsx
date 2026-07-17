import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/LoginForm";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp,
    },
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it("sends a magic link and shows confirmation", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/stashes" />);

    await user.type(screen.getByLabelText("Email"), "you@example.com");
    await user.click(screen.getByRole("button", { name: "Send login link" }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "you@example.com",
        options: {
          emailRedirectTo: expect.stringContaining(
            "/auth/callback?next=%2Fstashes"
          ),
        },
      });
    });

    expect(screen.getByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText("you@example.com")).toBeInTheDocument();
  });

  it("surfaces OTP errors", async () => {
    signInWithOtp.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });
    const user = userEvent.setup();
    render(<LoginForm nextPath="/settings" />);

    await user.type(screen.getByLabelText("Email"), "you@example.com");
    await user.click(screen.getByRole("button", { name: "Send login link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rate limit exceeded"
    );
  });
});
