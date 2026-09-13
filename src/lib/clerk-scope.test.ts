import { describe, expect, it } from "vitest";

import {
  hasClerkCookies,
  isClerkReturnTrip,
  routeNeedsClerkContext,
  shouldBypassClerk,
} from "./clerk-scope";

const crawler = (pathname: string, extra: Partial<Parameters<typeof shouldBypassClerk>[0]> = {}) =>
  shouldBypassClerk({ method: "GET", pathname, search: "", cookie: null, ...extra });

describe("routeNeedsClerkContext", () => {
  it("flags the routes whose server code calls auth()", () => {
    for (const p of [
      "/account",
      "/account/library",
      "/admin/books/x/edit",
      "/order/abc",
      "/read/123",
      "/api/entitlement",
      "/api/webhooks/lemonsqueezy",
      "/trpc/x",
    ]) {
      expect(routeNeedsClerkContext(p), p).toBe(true);
    }
  });

  it("leaves the public catalog, blog and crawler files alone", () => {
    for (const p of [
      "/",
      "/books",
      "/books/the-great-book-of-world-games",
      "/blog/royal-game-of-ur-rules",
      "/companion/world-games",
      "/sitemap.xml",
      "/robots.txt",
      "/accounts-payable", // prefix must match on a path boundary
      "/orders-faq",
    ]) {
      expect(routeNeedsClerkContext(p), p).toBe(false);
    }
  });
});

describe("hasClerkCookies / isClerkReturnTrip", () => {
  it("detects Clerk cookies anywhere in the header", () => {
    expect(hasClerkCookies("__session=abc")).toBe(true);
    expect(hasClerkCookies("vp_consent=1; __client_uat=1700000000")).toBe(true);
    expect(hasClerkCookies("vp_consent=1; __clerk_db_jwt=x")).toBe(true);
    expect(hasClerkCookies("vp_consent=1; theme=dark")).toBe(false);
    expect(hasClerkCookies(null)).toBe(false);
    expect(hasClerkCookies("")).toBe(false);
  });

  it("recognises handshake return trips", () => {
    expect(isClerkReturnTrip("?__clerk_handshake=eyJ")).toBe(true);
    expect(isClerkReturnTrip("?__clerk_db_jwt=x")).toBe(true);
    expect(isClerkReturnTrip("?utm_source=x")).toBe(false);
    expect(isClerkReturnTrip("")).toBe(false);
    expect(isClerkReturnTrip(null)).toBe(false);
  });
});

describe("shouldBypassClerk", () => {
  it("serves cookieless crawler GETs on public routes without Clerk", () => {
    expect(crawler("/")).toBe(true);
    expect(crawler("/sitemap.xml")).toBe(true);
    expect(crawler("/robots.txt")).toBe(true);
    expect(crawler("/books/the-great-book-of-world-games")).toBe(true);
    expect(crawler("/blog/senet-rules-reconstruction")).toBe(true);
    expect(crawler("/", { method: "HEAD" })).toBe(true);
  });

  it("keeps Clerk in front of everything that needs auth()", () => {
    expect(crawler("/account/library")).toBe(false);
    expect(crawler("/admin")).toBe(false);
    expect(crawler("/order/abc")).toBe(false);
    expect(crawler("/read/1")).toBe(false);
    expect(crawler("/api/entitlement")).toBe(false);
  });

  it("keeps Clerk for Server Actions and other non-GET requests", () => {
    expect(crawler("/books/the-great-book-of-world-games", { method: "POST" })).toBe(false);
    expect(crawler("/", { method: "OPTIONS" })).toBe(false);
  });

  it("keeps Clerk once a visitor has Clerk cookies or is mid-handshake", () => {
    expect(crawler("/", { cookie: "__client_uat=1700000000; __session=abc" })).toBe(false);
    expect(crawler("/", { cookie: "__clerk_db_jwt=abc" })).toBe(false);
    expect(crawler("/", { search: "?__clerk_handshake=eyJ" })).toBe(false);
    expect(crawler("/", { cookie: "vp_consent=1" })).toBe(true);
  });
});
