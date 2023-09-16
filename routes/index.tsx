import type { Handlers, PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import Counter from "../islands/Counter.tsx";

interface HomeProps {}

let peers = new Map();
let sockets = [];

export const handler: Handlers<HomeProps> = {
  async GET(req, ctx) {
    if (req.headers.get("upgrade") != "websocket") {
      return ctx.render();
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    sockets.push(socket);
    socket.addEventListener("open", () => {
      socket?.send(JSON.stringify([...peers.values()]));
    });

    socket.addEventListener("close", () => {
      sockets = sockets.filter((i) => i !== socket);
    });

    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      console.log(socket.OPEN);
      if (data.type === "add") {
        peers.set(data.data.user, data.data);
        sockets.forEach((socket) => {
          if (socket.readyState === socket.OPEN) {
            socket?.send(JSON.stringify([...peers.values()]));
          }
        });
      }
    });
    return response;
  },
};

export default function Home(props: PageProps<HomeProps>) {
  return (
    <>
      <Head>
        <meta lang="zh-CN"/>
        <title>Fresh App with Deno KV</title>
        <script src="https://unpkg.com/peerjs@1.5.0/dist/peerjs.js"></script>
      </Head>
      <div class="p-4">
        <Counter />
      </div>
    </>
  );
}
