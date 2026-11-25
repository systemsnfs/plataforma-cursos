/* Duração automática de arquivos de vídeo: sem enviar o arquivo ao servidor. */
window.LegionVideoDuration = {
  async read(source) {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      let objectUrl = null, settled = false;
      const timer = setTimeout(() => finish(null, new Error("Tempo limite para ler o vídeo.")), 15000);
      function finish(seconds, error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.removeAttribute("src");
        video.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (error) reject(error); else resolve(seconds);
      }
      video.addEventListener("loadedmetadata", () => {
        const seconds = Number(video.duration);
        if (Number.isFinite(seconds) && seconds > 0) finish(seconds);
        else finish(null, new Error("Duração indisponível."));
      }, {once:true});
      video.addEventListener("error", () => finish(null, new Error("Não foi possível ler os metadados.")), {once:true});
      try {
        if (source instanceof File) {
          objectUrl = URL.createObjectURL(source);
          video.src = objectUrl;
        } else {
          const url = new URL(String(source), window.location.href);
          if (!["https:", "http:"].includes(url.protocol)) throw new Error("URL inválida.");
          video.src = url.href;
        }
        video.load();
      } catch(error) { finish(null,error); }
    });
  },
  format(seconds) {
    const rounded = Math.max(0,Math.round(seconds));
    return Math.floor(rounded/60) + ":" + String(rounded%60).padStart(2,"0");
  }
};
