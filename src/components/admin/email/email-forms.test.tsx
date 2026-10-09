import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailActionState } from "@/app/admin/email/actions";

/**
 * The admin's email forms, as an administrator meets them.
 *
 * The server actions are replaced (their own tests are in `actions.test.ts`),
 * so what is held to account here is the FORM: that the safe choice is the
 * default, that the evidence box appears when an opt-in is chosen, that every
 * problem is attached to the field it concerns and announced, that "add anyway"
 * exists only after a warning and sends only what it should, that someone who
 * unsubscribed is offered NO controls, and that a delete is behind a question.
 */

const actions = vi.hoisted(() => ({
  addContactAction: vi.fn(),
  updateDetailsAction: vi.fn(),
  suppressContactAction: vi.fn(),
  optInContactAction: vi.fn(),
  markNotMarketingAction: vi.fn(),
  deleteContactAction: vi.fn(),
}));
vi.mock("@/app/admin/email/actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => {
    void prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

import { AddContactForm } from "./add-contact-form";
import { ConsentPanel, ContactDetailsForm, DeletePanel } from "./contact-editor";

const ok = (message: string, id?: string): EmailActionState => ({ status: "ok", message, ...(id ? { id } : {}) });
const bad = (error: string, extra: Partial<Extract<EmailActionState, { status: "error" }>> = {}): EmailActionState => ({ status: "error", error, ...extra });
const ID = "7a5d9f85-6de2-4bb1-aeda-9742fdbfd5bb";

/** The FormData the last call of an action received. */
const submitted = (fn: ReturnType<typeof vi.fn>, call = -1): Record<string, string> => {
  const calls = fn.mock.calls;
  const form = calls.at(call)?.[1] as FormData;
  return Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, String(v)]));
};

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ status: "idle" });
});
afterEach(cleanup);

describe("<AddContactForm>", () => {
  const open = () => {
    render(<AddContactForm />);
    fireEvent.click(screen.getByText("Add a contact")); // the disclosure
  };

  it("starts on the SAFE choice — 'I only know the address' — and has no evidence box", () => {
    open();
    expect((screen.getByLabelText(/I only know the address/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/They agreed to marketing email/) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText(/Evidence they agreed/)).toBeNull();
  });

  it("choosing 'they agreed' asks for the evidence; going back removes the question", () => {
    open();
    fireEvent.click(screen.getByLabelText(/They agreed to marketing email/));
    expect(screen.getByLabelText(/Evidence they agreed/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Not a marketing contact/));
    expect(screen.queryByLabelText(/Evidence they agreed/)).toBeNull();
  });

  it("sends what was typed, and the consent state chosen", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.org" } });
    fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "Jane" } });
    fireEvent.click(screen.getByLabelText(/They agreed to marketing email/));
    fireEvent.change(screen.getByLabelText(/Evidence they agreed/), { target: { value: "Replied yes to the 12 October email" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Add contact" }).closest("form")!);
    });
    expect(submitted(actions.addContactAction)).toMatchObject({
      email: "jane@example.org",
      name: "Jane",
      consent: "opted_in",
      evidence: "Replied yes to the 12 October email",
    });
    expect(submitted(actions.addContactAction)).not.toHaveProperty("allowAlias");
  });

  it("every problem is attached to its own field and announced", async () => {
    actions.addContactAction.mockResolvedValue(bad("Check the highlighted fields.", { errors: { email: "That doesn't look like an email address.", name: "Keep the name to 120 characters." } }));
    open();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "nope" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "met at the fair" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Add contact" }).closest("form")!);
    });
    const email = screen.getByLabelText("Email address");
    // What the administrator typed is STILL THERE. (React 19 clears a `<form action>` after every
    // submission, problem or not; this form does not use that.)
    expect((email as HTMLInputElement).value).toBe("nope");
    expect((screen.getByLabelText("Notes (optional)") as HTMLTextAreaElement).value).toBe("met at the fair");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    const described = document.getElementById(email.getAttribute("aria-describedby")!.split(" ")[0]);
    expect(described?.textContent).toBe("That doesn't look like an email address.");
    expect(screen.getByLabelText("Name (optional)").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Notes (optional)").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByRole("alert").textContent).toBe("Check the highlighted fields.");
  });

  it("'add anyway' appears ONLY after an alias warning, and sends allowAlias=on and nothing else new", async () => {
    actions.addContactAction.mockResolvedValueOnce(
      bad("That looks like another address for jane.doe@gmail.com…", { errors: { email: "That looks like another address for jane.doe@gmail.com…" }, canForce: true, existingId: ID }),
    );
    open();
    expect(screen.queryByRole("button", { name: /add anyway/i })).toBeNull();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "janedoe+x@gmail.com" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Add contact" }).closest("form")!);
    });
    expect(screen.getByRole("link", { name: "Open the existing contact" }).getAttribute("href")).toBe(`/admin/email/${ID}`);
    const anyway = screen.getByRole("button", { name: /add anyway/i });
    actions.addContactAction.mockResolvedValueOnce(ok("Added janedoe+x@gmail.com.", ID));
    await act(async () => {
      fireEvent.click(anyway);
    });
    expect(actions.addContactAction).toHaveBeenCalledTimes(2);
    expect(submitted(actions.addContactAction)).toMatchObject({ email: "janedoe+x@gmail.com", allowAlias: "on" });
  });

  it("a success says so politely, links to the new contact, and empties the form", async () => {
    actions.addContactAction.mockResolvedValue(ok("Added jane@example.org.", ID));
    open();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.org" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Add contact" }).closest("form")!);
    });
    expect(screen.getByRole("status").textContent).toBe("Added jane@example.org.");
    expect(screen.getByRole("link", { name: "Open it" }).getAttribute("href")).toBe(`/admin/email/${ID}`);
    await waitFor(() => expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe(""));
  });
});

describe("<ContactDetailsForm>", () => {
  it("starts from what is on file, saves only name/notes/source detail for THIS contact, and says 'Saved.'", async () => {
    actions.updateDetailsAction.mockResolvedValue(ok("Saved."));
    render(<ContactDetailsForm id={ID} name="Jane" notes="likes puzzles" sourceDetail="book fair" />);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Jane");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("likes puzzles");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Jane D." } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Save details" }).closest("form")!);
    });
    expect(submitted(actions.updateDetailsAction)).toEqual({ id: ID, name: "Jane D.", sourceDetail: "book fair", notes: "likes puzzles" });
    expect(screen.getByRole("status").textContent).toBe("Saved.");
  });
});

describe("<ConsentPanel> — what can be done, and what cannot", () => {
  it("someone who unsubscribed gets NO controls — only the explanation", () => {
    for (const props of [
      { consent: "opted_out" as const, unsubscribed: true },
      { consent: "opted_in" as const, unsubscribed: true },
      { consent: "opted_out" as const, unsubscribed: false },
    ]) {
      const { container, unmount } = render(<ConsentPanel id={ID} {...props} />);
      expect(container.querySelector("[data-consent-locked]")?.textContent).toMatch(/Only they can opt back in/);
      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByRole("textbox")).toBeNull();
      unmount();
    }
  });

  it("Suppress asks first, and only the second press does it", async () => {
    actions.suppressContactAction.mockResolvedValue(ok("Suppressed. They will not be emailed."));
    render(<ConsentPanel id={ID} consent="opted_in" unsubscribed={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Suppress — stop emailing/ }));
    expect(actions.suppressContactAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Stop emailing this person\?/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); // changing your mind costs nothing
    expect(screen.queryByText(/Stop emailing this person\?/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Suppress — stop emailing/ }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Yes, suppress" }).closest("form")!);
    });
    expect(submitted(actions.suppressContactAction)).toEqual({ id: ID });
    expect(screen.getByRole("status").textContent).toMatch(/Suppressed/);
  });

  it("the confirmation SURVIVES the panel turning into the 'unsubscribed' notice (the page re-renders around it)", async () => {
    actions.suppressContactAction.mockResolvedValue(ok("Suppressed. They will not be emailed."));
    const { rerender, container } = render(<ConsentPanel id={ID} consent="opted_in" unsubscribed={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Suppress — stop emailing/ }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Yes, suppress" }).closest("form")!);
    });
    // What the server's revalidation does next: the same contact, now suppressed.
    rerender(<ConsentPanel id={ID} consent="opted_out" unsubscribed />);
    expect(container.querySelector("[data-consent-locked]")).not.toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe("Suppressed. They will not be emailed.");
  });

  it("someone already opted in is offered Suppress and nothing that would re-record consent", () => {
    render(<ConsentPanel id={ID} consent="opted_in" unsubscribed={false} />);
    expect(screen.getByRole("button", { name: /Suppress/ })).toBeTruthy();
    expect(screen.queryByLabelText(/Record that they agreed/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark as not a marketing contact" })).toBeNull();
  });

  it("an unknown contact can be opted in WITH evidence, or marked not-a-marketing-contact", async () => {
    actions.optInContactAction.mockResolvedValue(bad("Opting someone in needs the evidence…", { errors: { evidence: "Opting someone in needs the evidence: say how and when they agreed." } }));
    render(<ConsentPanel id={ID} consent="unknown" unsubscribed={false} />);
    const evidence = screen.getByLabelText(/Record that they agreed/);
    fireEvent.change(evidence, { target: { value: "yes" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Record opt-in" }).closest("form")!);
    });
    expect(submitted(actions.optInContactAction)).toEqual({ id: ID, evidence: "yes" });
    expect(evidence.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(evidence.getAttribute("aria-describedby")!.split(" ").find((x) => x.endsWith("-error"))!)?.textContent).toMatch(/needs the evidence/);

    actions.markNotMarketingAction.mockResolvedValue(ok("Marked as not a marketing contact."));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark as not a marketing contact" }));
    });
    expect(submitted(actions.markNotMarketingAction)).toEqual({ id: ID });
  });
});

describe("<DeletePanel>", () => {
  it("is a button until pressed, then a question that names the address — and can be cancelled", () => {
    render(<DeletePanel id={ID} email="jane@example.org" unsubscribed={false} />);
    expect(screen.queryByText(/Permanently delete/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Delete this contact/ }));
    expect(screen.getByText(/Permanently delete/).textContent).toContain("jane@example.org");
    expect(screen.queryByRole("checkbox")).toBeNull(); // nothing to erase for an ordinary contact
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Permanently delete/)).toBeNull();
  });

  it("for someone who unsubscribed it asks, in so many words, whether to erase the suppression too", async () => {
    render(<DeletePanel id={ID} email="jane@example.org" unsubscribed />);
    fireEvent.click(screen.getByRole("button", { name: /Delete this contact/ }));
    const box = screen.getByRole("checkbox", { name: /erase the suppression record/i });
    fireEvent.click(box);
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Delete permanently" }).closest("form")!);
    });
    expect(submitted(actions.deleteContactAction)).toEqual({ id: ID, erase: "on" });
  });

  it("an unticked box sends no 'erase' — and the refusal's explanation is shown", async () => {
    actions.deleteContactAction.mockResolvedValue(bad("This person unsubscribed… Tick the box to erase them completely."));
    render(<DeletePanel id={ID} email="jane@example.org" unsubscribed={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete this contact/ }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Delete permanently" }).closest("form")!);
    });
    expect(submitted(actions.deleteContactAction)).toEqual({ id: ID });
    expect(within(screen.getByRole("alert")).getByText(/Tick the box/)).toBeTruthy();
    // ...and the tick-box now exists, because the server said it is needed
    expect(screen.getByRole("checkbox", { name: /erase the suppression record/i })).toBeTruthy();
  });
});
