import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VideoThumb from "@/components/VideoThumb";

describe("video thumbnails", () => {
  it("renders the stored poster without creating a video decoder", () => {
    const { container } = render(<VideoThumb src="https://media.example/video.mp4" poster="https://media.example/cover.jpg" />);

    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("img", { name: "Video cover" })).toHaveAttribute("src", "https://media.example/cover.jpg");
  });

  it("shows a lightweight play placeholder when no poster exists", () => {
    const { container } = render(<VideoThumb src="https://media.example/video.mp4" />);

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
