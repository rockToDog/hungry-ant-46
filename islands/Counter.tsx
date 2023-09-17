import { type StateUpdater, useState, useEffect, useRef } from "preact/hooks";
import { Button } from "../components/Button.tsx";
import Progress from "./Progress.tsx";
// import { Peer } from "peerjs";

const Peer = window.Peer as unknown as any;
interface CounterProps {
  start: number;
}

export const download = (data: { file: ArrayBuffer[]; fileName?: string }) => {
  const link = window.URL.createObjectURL(
    new Blob(data.file, { type: "arrayBuffer" })
  );
  const a = document.createElement("a");
  a.href = link;
  a.download = data.fileName || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(link);
};

const readAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent) => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
  });
};

export default function Counter() {
  const [peers, setPeers] = useState([]);
  const [user, setUser] = useState();
  const [progress, setProgress] = useState();
  const peerRef = useRef();
  const socketRef = useRef();
  const fileInfoRef = useRef({});

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!!user) {
      setUser(user);
      init(user);
    }
  }, []);

  const init = (user) => {
    peerRef.current = new Peer();
    console.log(peerRef.current);
    peerRef.current.on("open", () => {
      handleIncomingConnection();
      startWebsocket(user);
      window.addEventListener("beforeunload", disconnectWebsocket);
    });
  };

  const startWebsocket = (user) => {
    const socket = new WebSocket("wss://rocktodog.deno.dev");
    // const socket = new WebSocket("ws://192.168.10.109:8000");
    socketRef.current = socket;
    socket.addEventListener("open", function (event) {
      peerRef.current.id &&
        socket.send(
          JSON.stringify({
            type: "add",
            data: {
              user: user,
              peerId: peerRef.current.id,
            },
          })
        );
    });

    // Listen for messages
    socket.addEventListener("message", function (event) {
      console.log(event.data);
      setPeers(JSON.parse(event.data));
    });
  };

  const disconnectWebsocket = () => {
    socketRef.current?.close?.();
  };

  const handleIncomingConnection = () => {
    peerRef.current?.on("connection", function (conn) {
      console.log("Incoming connection: " + conn);
      conn.on("open", function () {
        console.log("open: " + conn.id);
        conn.on("data", function (receivedData) {
          console.log("Receiving data");
          if (receivedData?.dataType === "FILE") {
            fileInfoRef.current = receivedData;
          } else {
            fileInfoRef.current.receivedSize += receivedData.byteLength;
            fileInfoRef.current.file.push(receivedData);
            setProgress(
              parseInt(
                (fileInfoRef.current.receivedSize /
                  fileInfoRef.current.fileSize) *
                  100
              )
            );
            if (
              fileInfoRef.current.fileSize === fileInfoRef.current.receivedSize
            ) {
              download(fileInfoRef.current);
              fileInfoRef.current = {};
              setProgress(0);
              return;
            }
          }
        });
      });
    });
  };

  const connectPeer = (id) => {
    return new Promise((resolve, reject) => {
      try {
        let conn = peerRef.current.connect(id, { reliable: true });
        if (!conn) {
          reject(new Error("Connection can't be established"));
        } else {
          conn
            .on("open", function () {
              console.log("Connect to: " + id);
              resolve({ id, conn });
            })
            .on("error", function (err) {
              console.log(err);
              reject(err);
            });
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  const sendFile = async (conn, file) => {
    fileInfoRef.current = {
      file: [],
      receivedSize: 0,
      dataType: "FILE",
      fileSize: file.size,
      fileName: file.name,
      fileType: file.type,
    };
    conn.send(fileInfoRef.current);
    let offset = 0;
    let buffer: ArrayBuffer;
    const chunkSize =
      conn.peerConnection.sctp?.maxMessageSize || 10 * 1024 * 1024;
    while (offset < file.size) {
      const slice = file.slice(offset, offset + chunkSize);
      buffer =
        typeof slice.arrayBuffer === "function"
          ? await slice.arrayBuffer()
          : await readAsArrayBuffer(slice);
      if (conn.dataChannel.bufferedAmount > chunkSize) {
        await new Promise((resolve) => {
          conn.dataChannel.onbufferedamountlow = resolve;
        });
      }

      conn.send(buffer);
      console.log(parseInt((offset / file.size) * 100 + ""));
      setProgress(parseInt((offset / file.size) * 100));
      offset += buffer.byteLength;
    }
    setProgress(0);
    fileInfoRef.current = {};
  };

  const handleChange = async (id, e) => {
    const fileList = e.target.files;
    const { conn } = await connectPeer(id);
    let file = fileList[0] as unknown as File;
    // let blob = new Blob([file], { type: file.type });
    // blob = await blob.arrayBuffer();
    sendFile(conn, file);
    // conn.send();
  };

  const handleUserChange = (e) => {
    localStorage.setItem("user", e.target.value);
    setUser(e.target.value);
    init(e.target.value);
  };

  return (
    <div>
      {!!progress && (
        <Progress progress={progress} file={fileInfoRef.current} />
      )}
      {!user ? (
        <input
          className={"bg-blue-200 active:border-black"}
          onChange={handleUserChange}
        />
      ) : (
        <div className="font-bold pb-4">{user}</div>
      )}

      <div className={"w-full flex gap-2 flex-col"}>
        {peers?.map((i) => (
          <div>
            <div class="block p-4 m-auto bg-white rounded-lg shadow">
              <div>
                <span class="text-xs font-light inline-block py-1 px-2 uppercase rounded-full text-white bg-black">
                  <label className="" for={i.peerId}>
                    {i.user}
                  </label>
                  <input
                    className="hidden"
                    onChange={handleChange.bind(null, i.peerId)}
                    id={i.peerId}
                    type="file"
                    class="bg-blue-200"
                  />
                </span>
              </div>
            </div>
          </div>

          // <div
          //   className={
          //     "flex justify-between w-full transition-all cursor-pointer p-2 inline-block bg-blue-100 hover:bg-blue-200"
          //   }
          // >
          //   <label className="" for={i.peerId}>
          //     {i.user}
          //   </label>
          //   <input
          //     className="hidden"
          //     onChange={handleChange.bind(null, i.peerId)}
          //     id={i.peerId}
          //     type="file"
          //     class="bg-blue-200"
          //   />
          //   <div>123123</div>
          // </div>
        ))}
      </div>
    </div>
  );
}
