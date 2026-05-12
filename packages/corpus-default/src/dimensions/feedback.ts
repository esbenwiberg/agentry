import { defineDimension } from "@esbenwiberg/repofit/sdk";

export default defineDimension({
  id: "feedback",
  name: "Feedback",
  description: "Can the agent verify its own changes?",
  gating: false,
});
