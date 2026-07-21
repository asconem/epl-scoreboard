import BoardClient from "@/components/BoardClient";
export const dynamic = "force-dynamic";
export default function Home() {
  return <BoardClient admin={false} />;
}
