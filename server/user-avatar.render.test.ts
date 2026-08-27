import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "../client/src/components/UserAvatar";

describe("UserAvatar", () => {
  it("renders an uploaded profile image with an accessible label", () => {
    const html = renderToStaticMarkup(createElement(UserAvatar, {
      user: { name: "Taylor Morgan", profileImageUrl: "/manus-storage/profile-images/1/avatar.png" },
      className: "top-avatar",
    }));
    expect(html).toContain('src="/manus-storage/profile-images/1/avatar.png"');
    expect(html).toContain("Taylor Morgan");
    expect(html).toContain("top-avatar");
  });

  it("falls back to an initial when no image is uploaded", () => {
    const html = renderToStaticMarkup(createElement(UserAvatar, { user: { name: "Taylor Morgan" } }));
    expect(html).toContain(">T<");
  });
});
