import { describe, expect, it } from "vitest";

import { canonicalEmail, findAliasGroups, isFoldableDomain } from "./email-identity";

describe("canonicalEmail — the mailbox, not the spelling", () => {
  it("lower-cases and trims", () => {
    expect(canonicalEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });

  it("folds Gmail dots, +tags and the googlemail domain into one mailbox", () => {
    const one = canonicalEmail("jane.doe@gmail.com");
    for (const alias of ["janedoe@gmail.com", "j.a.n.e.d.o.e@gmail.com", "jane.doe+books@gmail.com", "JANEDOE+x+y@GoogleMail.com"]) {
      expect(canonicalEmail(alias), alias).toBe(one);
    }
    expect(one).toBe("janedoe@gmail.com");
  });

  it("drops +tags only where the provider documents them (Outlook, iCloud, Proton, …)", () => {
    expect(canonicalEmail("a+news@outlook.com")).toBe("a@outlook.com");
    expect(canonicalEmail("a+news@icloud.com")).toBe("a@icloud.com");
    expect(canonicalEmail("a+news@proton.me")).toBe("a@proton.me");
    // but a dot there IS significant
    expect(canonicalEmail("a.b@outlook.com")).not.toBe(canonicalEmail("ab@outlook.com"));
  });

  it("leaves every other domain alone — at a company server a+b@x.org may be someone else", () => {
    expect(canonicalEmail("a+b@company.org")).toBe("a+b@company.org");
    expect(canonicalEmail("first.last@company.org")).toBe("first.last@company.org");
    expect(canonicalEmail("a@yahoo.com")).toBe("a@yahoo.com");
  });

  it("never throws on rubbish", () => {
    for (const bad of ["", "   ", "no-at-sign", "@nolocal.com", "nodomain@", "a@b@gmail.com"]) {
      expect(() => canonicalEmail(bad), JSON.stringify(bad)).not.toThrow();
    }
    expect(canonicalEmail("no-at-sign")).toBe("no-at-sign");
  });

  it("is idempotent", () => {
    for (const e of ["J.Doe+x@gmail.com", "a+b@outlook.com", "x@y.org"]) {
      expect(canonicalEmail(canonicalEmail(e))).toBe(canonicalEmail(e));
    }
  });
});

describe("isFoldableDomain", () => {
  it("says whether an alias of this address could exist in the same domain", () => {
    expect(isFoldableDomain("a@gmail.com")).toBe(true);
    expect(isFoldableDomain("a@googlemail.com")).toBe(true);
    expect(isFoldableDomain("a@outlook.com")).toBe(true);
    expect(isFoldableDomain("a@company.org")).toBe(false);
    // leading space and capitals must not shift where the domain is read from
    expect(isFoldableDomain("   A@Gmail.com")).toBe(true);
  });
});

describe("findAliasGroups", () => {
  const row = (email: string, id = email) => ({ id, email });

  it("finds the same mailbox under different spellings", () => {
    const rows = [row("jane.doe@gmail.com"), row("x@company.org"), row("janedoe+books@gmail.com"), row("JANEDOE@googlemail.com")];
    const groups = findAliasGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonical).toBe("janedoe@gmail.com");
    expect(groups[0].members.map((m) => m.id)).toEqual(["jane.doe@gmail.com", "janedoe+books@gmail.com", "JANEDOE@googlemail.com"]);
  });

  it("is empty when nobody is duplicated", () => {
    expect(findAliasGroups([row("a@x.org"), row("b@x.org"), row("a@y.org")])).toEqual([]);
    expect(findAliasGroups([])).toEqual([]);
  });

  it("does not treat different people as one", () => {
    expect(findAliasGroups([row("a+b@company.org"), row("a@company.org")])).toEqual([]);
  });

  it("puts the biggest group first, then alphabetical, and keeps member order", () => {
    const groups = findAliasGroups([
      row("z.z@gmail.com"),
      row("zz@gmail.com"),
      row("a.b@gmail.com"),
      row("ab+1@gmail.com"),
      row("ab+2@gmail.com"),
    ]);
    expect(groups.map((g) => g.canonical)).toEqual(["ab@gmail.com", "zz@gmail.com"]);
    expect(groups[0].members.map((m) => m.id)).toEqual(["a.b@gmail.com", "ab+1@gmail.com", "ab+2@gmail.com"]);
  });
});
