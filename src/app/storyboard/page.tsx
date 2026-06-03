import { redirect } from "next/navigation";

// Storyboard mode is entered via the "Storyboard" card on /start, which creates a
// project and routes to /storyboard/[id]. A bare /storyboard goes back to modes.
export default function StoryboardIndex() {
  redirect("/start");
}
