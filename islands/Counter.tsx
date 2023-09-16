import { type StateUpdater, useState, useEffect, useRef } from "preact/hooks";
import { Button } from "../components/Button.tsx";
// import { Peer } from "peerjs";

const Peer = window.Peer as unknown as any;
interface CounterProps {
  start: number;
}

const download = (data, filename, mime, bom) => {
  var blobData = typeof bom !== "undefined" ? [bom, data] : [data];
  var blob = new Blob(blobData, { type: mime || "application/octet-stream" });
  if (typeof window.navigator.msSaveBlob !== "undefined") {
    // IE workaround for "HTML7007: One or more blob URLs were
    // revoked by closing the blob for which they were created.
    // These URLs will no longer resolve as the data backing
    // the URL has been freed."
    window.navigator.msSaveBlob(blob, filename);
  } else {
    var blobURL =
      window.URL && window.URL.createObjectURL
        ? window.URL.createObjectURL(blob)
        : window.webkitURL.createObjectURL(blob);
    var tempLink = document.createElement("a");
    tempLink.style.display = "none";
    tempLink.href = blobURL;
    tempLink.setAttribute("download", filename);
    if (typeof tempLink.download === "undefined") {
      tempLink.setAttribute("target", "_blank");
    }

    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(function () {
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(blobURL);
    }, 200);
  }
};

function fileToBlob(file) {
  // 创建 FileReader 对象
  let reader = new FileReader();
  return new Promise((resolve) => {
    // FileReader 添加 load 事件
    reader.addEventListener("load", (e) => {
      let blob;
      if (typeof e.target.result === "object") {
        blob = new Blob([e.target.result]);
      } else {
        blob = e.target.result;
      }
      console.log(Object.prototype.toString.call(blob));
      resolve(blob);
    });
    // FileReader 以 ArrayBuffer 格式 读取 File 对象中数据
    reader.readAsArrayBuffer(file);
  });
}

export default function Counter() {
  const [peers, setPeers] = useState([]);
  const [user, setUser] = useState(localStorage.getItem("user"));
  const peerRef = useRef();
  const socketRef = useRef();

  useEffect(() => {
    if (!!user) {
      peerRef.current = new Peer();
      handleIncomingConnection();
      startWebsocket();
      window.addEventListener("beforeunload", disconnectWebsocket);
    }
  }, [user]);

  const startWebsocket = () => {
    const socket = new WebSocket("ws://localhost:8000");
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
          let data = receivedData;
          download(data.file || "", data.fileName || "fileName", data.fileType);
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

  const handleChange = async (id, e) => {
    const fileList = e.target.files;
    const { conn } = await connectPeer(id);
    let file = fileList[0] as unknown as File;
    let blob = new Blob([file], { type: file.type });
    blob = await blob.arrayBuffer();

    conn.send({
      dataType: "FILE",
      file: blob,
      fileName: file.name,
      fileType: file.type,
    });
  };

  const handleUserChange = (e) => {
    localStorage.setItem("user", e.target.value);
    setUser(e.target.value);
  };

  return (
    <div>
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
          <div className={"w-full"}>
            <label
              className="w-full transition-all cursor-pointer p-2 inline-block bg-blue-100 hover:bg-blue-200"
              for={i.peerId}
            >
              {i.user}
            </label>
            <input
              className="hidden"
              onChange={handleChange.bind(null, i.peerId)}
              id={i.peerId}
              type="file"
              class="bg-blue-200"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
