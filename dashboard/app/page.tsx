import Console from "@/components/Console";
import { SCENARIOS } from "@/lib/data";

export default function Page() {
  return <Console scenarios={SCENARIOS} />;
}
