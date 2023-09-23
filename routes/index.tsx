import type { Handlers, PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import Counter from "../islands/Counter.tsx";
import { getPeer, setPeer } from "../utils/db.ts";

let sockets: WebSocket[] = [];

export const handler: Handlers = {
  GET(req, ctx) {
    if (req.headers.get("upgrade") != "websocket") {
      return ctx.render();
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    sockets.push(socket);
    socket.addEventListener("open", async () => {
      const peers = await getPeer();
      socket?.send(JSON.stringify(peers));
    });

    socket.addEventListener("close", () => {
      sockets = sockets.filter((i) => i !== socket);
    });

    socket.addEventListener("message", async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "add") {
        await setPeer(data.data.user, data.data);
        const peers = await getPeer();
        console.log(peers);
        sockets.forEach((socket) => {
          if (socket.readyState === socket.OPEN) {
            socket?.send(JSON.stringify(peers));
          }
        });
      }
    });
    return response;
  },
};

export default function Home(props: PageProps) {
  return (
    <>
      <Head>
        <meta lang="zh-CN" />
        <title>Fresh App with Deno KV</title>
        <script src="https://unpkg.com/peerjs@1.5.0/dist/peerjs.js"></script>
        {/* <script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
        <script>var vConsole = new window.VConsole();</script> */}
      </Head>
      <div class="p-4">
        <Counter />
      </div>
    </>
  );
}
