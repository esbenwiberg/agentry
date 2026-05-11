import { defineDimension } from "@esbenwiberg/repofit/sdk";

export default defineDimension({
  id: "safety",
  name: "Safety",
  description: "What's the blast radius of a mistake?",
  gating: true,
});
