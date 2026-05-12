import { defineDimension } from "@esbenwiberg/repofit/sdk";

export default defineDimension({
  id: "cost",
  name: "Cost",
  description: "How many tokens does this repo cost per task?",
  gating: false,
});
