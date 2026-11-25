const sbA = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


const courseId = (
  new URLSearchParams(
    window.location.search
  ).get("id") || ""
).trim();


const $ = selector =>
  document.querySelector(selector);


const msgA = $("#message");

const courseBox = $("#course");
const modulesBox = $("#modules");

const moduleForm = $("#moduleForm");
const lessonForm = $("#lessonForm");

const moduleSelect = $("#moduleSelect");

let currentModules = [];


/* =====================================
   DURAÇÃO EM MM:SS
   O banco mantém minutos fracionários.
===================================== */
function parseLessonDuration(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return 0;
  const match = /^(\d+)(?::([0-5]\d))?$/.exec(value);
  if (!match) throw new Error("Informe a duração em minutos:segundos, por exemplo 2:34.");
  const minutes = Number(match[1]);
  const seconds = Number(match[2] || 0);
  if (!Number.isSafeInteger(minutes) || minutes > 999999) {
    throw new Error("A duração informada é muito grande.");
  }
  return Math.round((minutes + seconds / 60) * 1000000) / 1000000;
}

function formatLessonDuration(minutesValue) {
  const value = Number(minutesValue || 0);
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const totalSeconds = Math.round(value * 60);
  return Math.floor(totalSeconds / 60) + ":" + String(totalSeconds % 60).padStart(2, "0");
}

/* Ler duração do arquivo selecionado, preservando correções digitadas pelo administrador. */
async function detectSelectedVideoDuration(file, inputSelector, hintSelector, fileSelector) {
  const field = $(inputSelector), hint = $(hintSelector);
  if (!field || !file) return;
  const prior = field.value;
  if (hint) hint.textContent = "Identificando duração do vídeo...";
  try {
    const seconds = await window.LegionVideoDuration.read(file);
    if ($(fileSelector)?.files?.[0] !== file) return;
    const formatted = window.LegionVideoDuration.format(seconds);
    if (field.value !== prior) {
      if (hint) hint.textContent = "Duração detectada: " + formatted + ". Mantido o valor alterado manualmente.";
      return;
    }
    field.value = formatted;
    if (hint) hint.textContent = "Detectado automaticamente: " + formatted + ". Você pode ajustar manualmente.";
  } catch(error) {
    if (hint) hint.textContent = "Não foi possível detectar o tempo. Informe a duração manualmente (ex.: 2:34).";
    console.warn("Duração de vídeo indisponível:",error);
  }
}

/* =====================================
   INICIAR
===================================== */

async function init() {

  if (!courseId) {

    msgA.textContent =
      "ID do curso não encontrado.";

    return;
  }


  const {
    data: { user },
    error
  } = await sbA.auth.getUser();


  if (error || !user) {

    location.href =
      "login.html";

    return;
  }


  const {
    data: profile
  } = await sbA
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();


  if (
    !profile ||
    profile.role !== "admin"
  ) {

    location.href =
      "aluno.html";

    return;
  }


  await render();
}


/* =====================================
   CURSO
===================================== */

async function render() {

  const {
    data: course,
    error
  } = await sbA
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();


  if (error || !course) {

    msgA.textContent =
      "Não foi possível carregar o curso.";

    return;
  }


  courseBox.innerHTML = `

    <span class="eyebrow">
      CURSO
    </span>

    <h1>
      ${escapeHtml(course.title)}
    </h1>

    <p class="muted-text">
      ${escapeHtml(
        course.description || ""
      )}
    </p>

  `;


  await loadModules();
}


/* =====================================
   CARREGAR MÓDULOS
===================================== */

async function loadModules() {

  const {
    data,
    error
  } = await sbA
    .from("modules")
    .select(`
      *,
      lessons(*)
    `)
    .eq(
      "course_id",
      courseId
    )
    .order(
      "position",
      { ascending: true }
    );


  if (error) {

    msgA.textContent =
      error.message;

    return;
  }


  currentModules = data || [];
  const lessonCount = currentModules.reduce((n, module) => n + (module.lessons || []).length, 0);
  const publishedCount = currentModules.reduce((n, module) =>
    n + (module.lessons || []).filter(lesson => lesson.published === true).length, 0);
  if ($("#moduleTotal")) $("#moduleTotal").textContent = currentModules.length;
  if ($("#lessonTotal")) $("#lessonTotal").textContent = lessonCount;
  if ($("#publishedTotal")) $("#publishedTotal").textContent = publishedCount;
  if ($("#moduleCountLabel")) $("#moduleCountLabel").textContent =
    `${currentModules.length} ${currentModules.length === 1 ? "módulo" : "módulos"}`;


  renderModuleSelects();

  renderModules();
}


/* =====================================
   SELECTS DE MÓDULO
===================================== */

function renderModuleSelects() {

  const options =
    currentModules
      .map(module => `

        <option value="${module.id}">

          ${escapeHtml(
            module.title
          )}

        </option>

      `)
      .join("");


  moduleSelect.innerHTML =
    options ||
    `
      <option value="">
        Crie um módulo primeiro
      </option>
    `;


  $("#editLessonModule")
    .innerHTML =
      options;
}


/* =====================================
   MOSTRAR MÓDULOS
===================================== */

function renderModules() {

  if (!currentModules.length) {

    modulesBox.innerHTML = `

      <div class="course-content-empty">

        <div class="content-empty-icon">
          ◇
        </div>

        <strong>
          Nenhum módulo cadastrado
        </strong>

        <span>
          Crie o primeiro módulo para começar
          a organizar as aulas deste curso.
        </span>

      </div>

    `;

    return;
  }


  modulesBox.innerHTML =
    currentModules
      .map((module, moduleIndex) => {

        const lessons =
          [...(module.lessons || [])]
            .sort(
              (a, b) =>
                (a.position || 0) -
                (b.position || 0)
            );


        const moduleNumber =
          String(moduleIndex + 1)
            .padStart(2, "0");


        return `

          <div class="premium-module-card">

            <!-- CABEÇALHO DO MÓDULO -->

            <div class="premium-module-header">

              <div class="module-title-area">

                <div class="module-number">
                  ${moduleNumber}
                </div>


                <div>

                  <span class="module-label">
                    MÓDULO ${moduleNumber}
                  </span>

                  <h3>
                    ${escapeHtml(module.title)}
                  </h3>

                  <small>
                    ${lessons.length}
                    ${
                      lessons.length === 1
                        ? "aula"
                        : "aulas"
                    }
                  </small>

                </div>

              </div>


              <div class="module-actions">
                <button type="button" class="module-action-btn legion-module-add-lesson" data-id="${module.id}">＋ Aula</button>

                <button
                  type="button"
                  class="module-action-btn edit-module"
                  data-id="${module.id}"
                >
                  Editar
                </button>


                <button
                  type="button"
                  class="module-action-btn delete-action delete-module"
                  data-id="${module.id}"
                  data-title="${escapeAttribute(module.title)}"
                >
                  Excluir
                </button>

              </div>

            </div>


            <!-- AULAS -->

            <div class="premium-lessons" data-module-id="${module.id}">

              ${
                lessons.length

                  ? lessons
                      .map(
                        (lesson, lessonIndex) =>
                          renderLesson(
                            lesson,
                            lessonIndex,
                            module.id,
                            lessons.length
                          )
                      )
                      .join("")

                  : `

                    <div class="module-empty-lessons">

                      <span class="empty-small-icon">
                        ＋
                      </span>

                      <div>

                        <strong>
                          Nenhuma aula neste módulo
                        </strong>

                        <small>
                          Clique em "Nova aula" para adicionar conteúdo a este módulo.
                        </small>

                      </div>

                    </div>

                  `
              }

            </div>

          </div>

        `;

      })
      .join("");


  activateButtons();
  activateLessonOrdering();
}
/* =====================================
   MOSTRAR AULA
===================================== */

function renderLesson(
  lesson,
  lessonIndex,
  moduleId,
  lessonCount
) {

  const lessonNumber =
    String(lessonIndex + 1)
      .padStart(2, "0");


  const duration = formatLessonDuration(lesson.duration_minutes);


  return `

    <div class="premium-lesson-row" data-lesson-id="${lesson.id}" data-module-id="${moduleId}">

      <!-- REORDENAR -->
      <div class="legion-lesson-reorder" aria-label="Reorganizar esta aula">
        <button type="button" class="legion-drag-handle" draggable="true"
          data-id="${lesson.id}" data-module-id="${moduleId}"
          title="Arraste para reorganizar ou use as setas do teclado"
          aria-label="Arrastar aula ${escapeAttribute(lesson.title)} para alterar a ordem">☰</button>
        <div class="legion-lesson-shift">
          <button type="button" class="legion-lesson-move" data-id="${lesson.id}" data-module-id="${moduleId}" data-direction="-1"
            aria-label="Subir aula ${escapeAttribute(lesson.title)}" title="Mover aula para cima" ${lessonIndex === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="legion-lesson-move" data-id="${lesson.id}" data-module-id="${moduleId}" data-direction="1"
            aria-label="Descer aula ${escapeAttribute(lesson.title)}" title="Mover aula para baixo" ${lessonIndex === lessonCount - 1 ? "disabled" : ""}>↓</button>
        </div>
      </div>

      <!-- ÍCONE -->

      <div class="lesson-order">
        ${lessonNumber}
      </div>


      <!-- INFORMAÇÕES -->

      <div class="premium-lesson-info">

        <strong>
          ${escapeHtml(lesson.title)}
        </strong>


        <div class="lesson-meta">

          <span>
            ${duration}
          </span>


          <span class="lesson-meta-dot"></span>


          <span class="
            lesson-status
            ${
              lesson.published
                ? "lesson-published"
                : "lesson-draft"
            }
          ">

            <span class="lesson-status-dot"></span>

            ${
              lesson.published
                ? "Publicado"
                : "Rascunho"
            }

          </span>

        </div>

      </div>


      <!-- AÇÕES -->

      <div class="lesson-actions">

        <button
          type="button"
          class="lesson-action-btn edit-lesson"
          data-id="${lesson.id}"
        >
          Editar
        </button>


        <button
          type="button"
          class="
            lesson-action-btn
            delete-action
            delete-lesson
          "
          data-id="${lesson.id}"
          data-title="${escapeAttribute(lesson.title)}"
        >
          Excluir
        </button>

      </div>

    </div>

  `;
}
/* =====================================
   BOTÕES
===================================== */

function activateButtons() {
  document.querySelectorAll(".legion-module-add-lesson").forEach(button => {
    button.onclick = () => openNewLessonModal(button.dataset.id);
  });


  document
    .querySelectorAll(
      ".edit-module"
    )
    .forEach(button => {

      button.onclick =
        () =>
          openModuleModal(
            button.dataset.id
          );

    });


  document
    .querySelectorAll(
      ".delete-module"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteModule(
            button.dataset.id,
            button.dataset.title
          );

    });


  document
    .querySelectorAll(
      ".edit-lesson"
    )
    .forEach(button => {

      button.onclick =
        () =>
          openLessonModal(
            button.dataset.id
          );

    });


  document
    .querySelectorAll(
      ".delete-lesson"
    )
    .forEach(button => {

      button.onclick =
        () =>
          deleteLesson(
            button.dataset.id,
            button.dataset.title
          );

    });
}


/* ==================================================
   REORGANIZAR AULAS DENTRO DO MESMO MÓDULO
================================================== */
let lessonOrderingBusy = false;
let draggedLesson = null;

function lessonsSorted(module) {
  return [...(module?.lessons || [])].sort((a,b) =>
    (a.position ?? 0) - (b.position ?? 0) ||
    String(a.id).localeCompare(String(b.id))
  );
}

async function persistLessonOrder(moduleId, reorderedIds) {
  if (lessonOrderingBusy) return;
  const module = currentModules.find(item => item.id === moduleId);
  if (!module) return;
  const current = lessonsSorted(module);
  if (reorderedIds.length !== current.length ||
      reorderedIds.some(id => !current.some(item => item.id === id))) return;
  if (reorderedIds.every((id,index) => id === current[index].id)) return;

  lessonOrderingBusy = true;
  modulesBox.classList.add("legion-order-saving");
  msgA.textContent = "Salvando a nova ordem das aulas...";
  try {
    // Garante posições únicas e sequenciais no módulo, sem alterar conteúdos.
    for (let index = 0; index < reorderedIds.length; index++) {
      const {error} = await sbA.from("lessons")
        .update({position:index + 1})
        .eq("id", reorderedIds[index])
        .eq("module_id",moduleId);
      if (error) throw error;
    }
    msgA.textContent = "Ordem das aulas atualizada com sucesso!";
  } catch (error) {
    msgA.textContent = "Não foi possível reorganizar as aulas: " + (error?.message || "Tente novamente.");
  } finally {
    lessonOrderingBusy = false;
    modulesBox.classList.remove("legion-order-saving");
    await loadModules();
  }
}

function reorderedLessonIds(moduleId, fromId, toId, placeAfter = false) {
  const module = currentModules.find(item => item.id === moduleId);
  if (!module) return [];
  const ids = lessonsSorted(module).map(item => item.id);
  const fromIndex = ids.indexOf(fromId);
  if (fromIndex < 0 || !ids.includes(toId) || fromId === toId) return ids;
  ids.splice(fromIndex,1);
  const targetIndex = ids.indexOf(toId);
  ids.splice(targetIndex + (placeAfter ? 1 : 0),0,fromId);
  return ids;
}

function activateLessonOrdering() {
  modulesBox.querySelectorAll(".legion-lesson-move").forEach(button => {
    button.addEventListener("click", () => {
      const module = currentModules.find(m => m.id === button.dataset.moduleId);
      const ids = lessonsSorted(module).map(lesson => lesson.id);
      const index = ids.indexOf(button.dataset.id);
      const targetIndex = index + Number(button.dataset.direction);
      if (index < 0 || targetIndex < 0 || targetIndex >= ids.length) return;
      [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
      persistLessonOrder(button.dataset.moduleId,ids);
    });
  });

  modulesBox.querySelectorAll(".legion-drag-handle").forEach(handle => {
    handle.addEventListener("keydown",event => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? "-1" : "1";
      handle.closest(".legion-lesson-reorder")
        ?.querySelector('.legion-lesson-move[data-direction="' + direction + '"]')?.click();
    });
    handle.addEventListener("dragstart",event => {
      if (lessonOrderingBusy) {event.preventDefault();return;}
      draggedLesson = {id:handle.dataset.id,moduleId:handle.dataset.moduleId};
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain",handle.dataset.id);
      handle.closest(".premium-lesson-row")?.classList.add("legion-is-dragging");
    });
    handle.addEventListener("dragend", () => {
      draggedLesson = null;
      modulesBox.querySelectorAll(".premium-lesson-row").forEach(row => {
        row.classList.remove("legion-is-dragging","legion-drop-before","legion-drop-after");
      });
    });
  });

  modulesBox.querySelectorAll(".premium-lesson-row[data-lesson-id]").forEach(row => {
    row.addEventListener("dragover",event => {
      if (!draggedLesson || lessonOrderingBusy ||
          row.dataset.moduleId !== draggedLesson.moduleId ||
          row.dataset.lessonId === draggedLesson.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const below = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
      modulesBox.querySelectorAll(".premium-lesson-row").forEach(item =>
        item.classList.remove("legion-drop-before","legion-drop-after"));
      row.classList.add(below ? "legion-drop-after" : "legion-drop-before");
    });
    row.addEventListener("drop",event => {
      if (!draggedLesson || lessonOrderingBusy ||
          row.dataset.moduleId !== draggedLesson.moduleId) return;
      event.preventDefault();
      const {id,moduleId}=draggedLesson;
      const below = event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
      draggedLesson = null;
      const ids = reorderedLessonIds(moduleId,id,row.dataset.lessonId,below);
      persistLessonOrder(moduleId,ids);
    });
  });
}

/* =====================================
   NOVOS MÓDULO E AULA EM JANELAS
===================================== */
function openCreateModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.style.display = "flex";
  document.body.classList.add("legion-manager-modal-open");
}
function closeCreateModuleModal() {
  $("#createModuleModal").style.display = "none";
  document.body.classList.remove("legion-manager-modal-open");
}
function closeCreateLessonModal() {
  $("#createLessonModal").style.display = "none";
  document.body.classList.remove("legion-manager-modal-open");
  clearLessonSaveStatus();
}
function openNewLessonModal(selectedModuleId) {
  if (!currentModules.length) {
    msgA.textContent = "Crie um módulo antes de adicionar aulas.";
    openCreateModal("#createModuleModal");
    return;
  }
  if (selectedModuleId && currentModules.some(module => module.id === selectedModuleId)) {
    moduleSelect.value = selectedModuleId;
  }
  clearLessonSaveStatus();
  openCreateModal("#createLessonModal");
  $("#lessonTitle")?.focus();
}
$("#openModuleCreate")?.addEventListener("click", () => {
  openCreateModal("#createModuleModal");
  $("#moduleTitle")?.focus();
});
$("#openLessonCreate")?.addEventListener("click", () => openNewLessonModal());
$("#closeCreateModule")?.addEventListener("click", closeCreateModuleModal);
$("#cancelCreateModule")?.addEventListener("click", closeCreateModuleModal);
$("#closeCreateLesson")?.addEventListener("click", closeCreateLessonModal);
$("#cancelCreateLesson")?.addEventListener("click", closeCreateLessonModal);
for (const [id, close] of [
  ["#createModuleModal", closeCreateModuleModal],
  ["#createLessonModal", closeCreateLessonModal]
]) {
  $(id)?.addEventListener("click", event => {
    if (event.target === $(id)) close();
  });
}
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if ($("#createModuleModal")?.style.display === "flex") closeCreateModuleModal();
  if ($("#createLessonModal")?.style.display === "flex") closeCreateLessonModal();
});

/* =====================================
   CRIAR MÓDULO
===================================== */

moduleForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const title =
      $("#moduleTitle")
        .value
        .trim();


    if (!title) return;


    const {
      count
    } = await sbA
      .from("modules")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "course_id",
        courseId
      );


    const {
      error
    } = await sbA
      .from("modules")
      .insert({

        course_id:
          courseId,

        title,

        position:
          (count || 0) + 1

      });


    if (error) {

      msgA.textContent =
        error.message;

      return;
    }


    moduleForm.reset();
    closeCreateModuleModal();


    msgA.textContent =
      "Módulo criado com sucesso!";


    await loadModules();
  }
);


/* =====================================
   MODAL EDITAR MÓDULO
===================================== */

function openModuleModal(
  moduleId
) {

  const module =
    currentModules.find(
      item =>
        item.id === moduleId
    );


  if (!module) return;


  $("#editModuleId").value =
    module.id;


  $("#editModuleTitle").value =
    module.title || "";


  $("#editModuleModal")
    .style.display =
      "flex";
}


/* SALVAR MÓDULO */

$("#editModuleForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const moduleId =
        $("#editModuleId")
          .value;


      const title =
        $("#editModuleTitle")
          .value
          .trim();


      if (!title) {

        alert(
          "Informe o nome do módulo."
        );

        return;
      }


      const {
        error
      } = await sbA
        .from("modules")
        .update({
          title
        })
        .eq(
          "id",
          moduleId
        );


      if (error) {

        alert(
          error.message
        );

        return;
      }


      closeModuleModal();


      msgA.textContent =
        "Módulo atualizado com sucesso!";


      await loadModules();
    }
  );


function closeModuleModal() {

  $("#editModuleModal")
    .style.display =
      "none";
}


$("#closeModuleModal").onclick =
  closeModuleModal;


$("#cancelModuleEdit").onclick =
  closeModuleModal;


$("#editModuleModal").onclick =
  event => {

    if (
      event.target ===
      $("#editModuleModal")
    ) {

      closeModuleModal();

    }

  };


/* =====================================
   EXCLUIR MÓDULO
===================================== */

async function deleteModule(
  moduleId,
  title
) {

  const confirmed =
    confirm(
      `Excluir o módulo "${title}"?\n\nAs aulas dele também serão excluídas.`
    );


  if (!confirmed) return;


  const {
    data: lessons
  } = await sbA
    .from("lessons")
    .select("id")
    .eq(
      "module_id",
      moduleId
    );


  const lessonIds =
    (lessons || [])
      .map(
        lesson =>
          lesson.id
      );


  if (lessonIds.length) {

    await sbA
      .from("lesson_progress")
      .delete()
      .in(
        "lesson_id",
        lessonIds
      );


    const {
      error
    } = await sbA
      .from("lessons")
      .delete()
      .in(
        "id",
        lessonIds
      );


    if (error) {

      alert(
        error.message
      );

      return;
    }
  }


  const {
    error
  } = await sbA
    .from("modules")
    .delete()
    .eq(
      "id",
      moduleId
    );


  if (error) {

    alert(
      error.message
    );

    return;
  }


  msgA.textContent =
    "Módulo excluído com sucesso!";


  await loadModules();
}
/* =====================================
   UPLOAD DE PDF
===================================== */

const materialPdf =
  $("#materialPdf");

const selectPdfButton =
  $("#selectPdfButton");

const pdfFileName =
  $("#pdfFileName");


if (selectPdfButton && materialPdf) {

  selectPdfButton.onclick = () => {

    materialPdf.click();

  };

}


if (materialPdf) {

  materialPdf.addEventListener(
    "change",
    () => {

      const file =
        materialPdf.files[0];

      if (!file) {

        pdfFileName.textContent =
          "Nenhum PDF selecionado";

        return;

      }


      if (
        file.type !== "application/pdf"
      ) {

        alert(
          "Selecione somente arquivos PDF."
        );

        materialPdf.value = "";

        pdfFileName.textContent =
          "Nenhum PDF selecionado";

        return;

      }


      pdfFileName.textContent =
        file.name;

    }
  );

}


/* =====================================
   ENVIAR PDF PARA O SUPABASE
===================================== */

async function uploadLessonPdf() {

  const file =
    materialPdf?.files?.[0];


  /* PDF É OPCIONAL */

  if (!file) {

    return null;

  }


  if (
    file.type !== "application/pdf"
  ) {

    throw new Error(
      "O material precisa ser um arquivo PDF."
    );

  }


  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();


  const fileName =
    `${crypto.randomUUID()}.${extension}`;


  const filePath =
    `${courseId}/${fileName}`;


  const {
    error: uploadError
  } = await sbA.storage
    .from("materiais")
    .upload(
      filePath,
      file,
      {
        contentType:
          "application/pdf",

        upsert:
          false
      }
    );


  if (uploadError) {

    throw uploadError;

  }


  const {
    data
  } = sbA.storage
    .from("materiais")
    .getPublicUrl(
      filePath
    );


  return data.publicUrl;

}

/* =====================================
   UPLOAD DE VÍDEO PARA SUPABASE STORAGE
===================================== */
const lessonVideo = $("#lessonVideo");
const videoFileName = $("#videoFileName");
$("#selectVideoButton")?.addEventListener("click", () => lessonVideo?.click());
lessonVideo?.addEventListener("change", () => {
  const file = lessonVideo.files?.[0];
  if (!file) {
    videoFileName.textContent = "Nenhum vídeo selecionado";
    return;
  }
  const allowed = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowed.includes(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) {
    alert("Selecione um vídeo MP4, WebM ou MOV.");
    lessonVideo.value = "";
    videoFileName.textContent = "Nenhum vídeo selecionado";
    return;
  }
  videoFileName.textContent = file.name;
  detectSelectedVideoDuration(file, "#duration", "#durationAutoHint", "#lessonVideo");
});
const lessonStatus = $("#lessonSaveStatus");
function clearLessonSaveStatus() {
  if (!lessonStatus) return;
  lessonStatus.hidden = true;
  lessonStatus.textContent = "";
  lessonStatus.removeAttribute("data-status");
}
function setLessonStatus(text, kind = "info") {
  if (!lessonStatus) return;
  lessonStatus.hidden = false;
  lessonStatus.dataset.status = kind;
  lessonStatus.textContent = text;
  if (kind === "error") lessonStatus.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
async function uploadLessonVideo(file = lessonVideo?.files?.[0], reportProgress = setLessonStatus) {
  if (!file) return null;
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type) &&
      !/\.(mp4|webm|mov)$/i.test(file.name)) {
    throw new Error("Selecione um vídeo MP4, WebM ou MOV.");
  }
  const extension = file.name.split(".").pop().toLowerCase();
  const path = `${courseId}/${crypto.randomUUID()}.${extension}`;
  const mime = file.type || (extension === "mov" ? "video/quicktime" : `video/${extension}`);

  // Vídeos grandes usam o protocolo TUS com progresso e repetição de tentativas.
  if (file.size > 6 * 1024 * 1024) {
    if (!window.tus?.Upload) {
      throw new Error("O carregador de vídeos não foi iniciado. Atualize a página e tente novamente.");
    }
    const { data: { session }, error: sessionError } = await sbA.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error("Sua sessão expirou. Entre novamente antes de enviar o vídeo.");
    }
    const host = new URL(SUPABASE_URL).hostname.replace(".supabase.co", ".storage.supabase.co");
    await new Promise((resolve, reject) => {
      const upload = new window.tus.Upload(file, {
        endpoint: `https://${host}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000],
        chunkSize: 6 * 1024 * 1024,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "x-upsert": "false"
        },
        metadata: {
          bucketName: "videos",
          objectName: path,
          contentType: mime,
          cacheControl: "3600"
        },
        onError(error) { reject(error); },
        onProgress(uploaded, total) {
          const progress = total ? Math.round(uploaded * 100 / total) : 0;
          reportProgress(`Enviando vídeo: ${progress}% — mantenha esta janela aberta.`);
        },
        onSuccess() { resolve(); }
      });
      upload.start();
    });
  } else {
    reportProgress("Enviando vídeo... mantenha esta janela aberta.");
    const { error } = await sbA.storage.from("videos").upload(path, file, {
      contentType: mime,
      upsert: false
    });
    if (error) throw error;
  }
  return sbA.storage.from("videos").getPublicUrl(path).data.publicUrl;
}

/* =====================================
   CRIAR AULA
===================================== */

lessonForm.addEventListener("submit", async event => {
  event.preventDefault();
  const moduleId = moduleSelect.value;
  const title = $("#lessonTitle").value.trim();
  if (!moduleId) {
    setLessonStatus("Selecione um módulo antes de salvar a aula.", "error");
    return;
  }
  if (!title) {
    setLessonStatus("Informe o título da aula.", "error");
    return;
  }

  try {
    parseLessonDuration($("#duration").value);
  } catch (error) {
    setLessonStatus(error.message, "error");
    return;
  }

  const submitButton = lessonForm.querySelector('button[type="submit"]');
  if (submitButton?.disabled) return;
  submitButton.disabled = true;
  const previousLabel = submitButton.innerHTML;
  submitButton.textContent = "Salvando aula...";
  let videoUrl = null;
  let materialUrl = null;
  try {
    setLessonStatus("Preparando os arquivos...");
    if (materialPdf?.files?.length) {
      setLessonStatus("Enviando PDF...");
      materialUrl = await uploadLessonPdf();
    }
    if (lessonVideo?.files?.length) {
      videoUrl = await uploadLessonVideo();
    }
    setLessonStatus("Arquivos enviados. Registrando a aula...");
    const { count, error: countError } = await sbA
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("module_id", moduleId);
    if (countError) throw countError;

    const { error } = await sbA.from("lessons").insert({
      module_id: moduleId,
      title,
      description: $("#lessonDescription").value.trim(),
      video_url: videoUrl,
      material_url: materialUrl,
      duration_minutes: parseLessonDuration($("#duration").value),
      position: (count || 0) + 1,
      published: true
    });
    if (error) throw error;

    lessonForm.reset();
    if (pdfFileName) pdfFileName.textContent = "Nenhum PDF selecionado";
    if (videoFileName) videoFileName.textContent = "Nenhum vídeo selecionado";
    if ($("#durationAutoHint")) $("#durationAutoHint").textContent = "Ao selecionar um vídeo, a duração será preenchida automaticamente. Você pode editar o valor.";
    closeCreateLessonModal();
    msgA.textContent = "Aula salva com sucesso!";
    await loadModules();
  } catch (error) {
    console.error("Erro ao cadastrar aula:", error);
    const text = error?.message || "Erro desconhecido ao salvar a aula.";
    const likelySize = /413|exceeded|max.*size|payload too large|entity too large|size limit/i.test(text);
    const readable = likelySize
      ? "O arquivo ultrapassa o limite de tamanho do armazenamento. Comprima o vídeo ou revise o limite do Supabase."
      : "Não foi possível salvar: " + text;
    setLessonStatus(readable, "error");
    msgA.textContent = readable;
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = previousLabel;
  }
});

/* =====================================
   MODAL EDITAR AULA
===================================== */

async function openLessonModal(
  lessonId
) {

  const {
    data: lesson,
    error
  } = await sbA
    .from("lessons")
    .select("*")
    .eq(
      "id",
      lessonId
    )
    .single();


  if (error || !lesson) {

    alert(
      "Não foi possível carregar a aula."
    );

    return;
  }


  $("#editLessonId").value =
    lesson.id;


  $("#editLessonModule").value =
    lesson.module_id;


  $("#editLessonTitle").value =
    lesson.title || "";


  $("#editLessonDescription").value =
    lesson.description || "";


  $("#editVideoUrl").value =
    lesson.video_url || "";

  if ($("#editDurationAutoHint")) $("#editDurationAutoHint").textContent = "Ao selecionar um novo vídeo, a duração é preenchida automaticamente. Você também pode informar manualmente.";
  const editVideoFile = $("#editLessonVideoFile");
  if (editVideoFile) editVideoFile.value = "";
  const editVideoName = $("#editLessonVideoName");
  if (editVideoName) editVideoName.textContent = "Nenhum novo vídeo selecionado";
  const editVideoStatus = $("#editLessonVideoStatus");
  if (editVideoStatus) {
    editVideoStatus.hidden = true;
    editVideoStatus.textContent = "";
  }

  const removeVideoButton = $("#removeLessonVideo");
  const removeVideoStatus = $("#removeVideoStatus");
  if (removeVideoButton) {
    removeVideoButton.disabled = !Boolean(lesson.video_url?.trim());
    removeVideoButton.textContent = "✕ Excluir vídeo";
  }
  if (removeVideoStatus) {
    removeVideoStatus.hidden = true;
    removeVideoStatus.textContent = "";
  }


  $("#editMaterialUrl").value =
    lesson.material_url || "";

  const editPdfFile = $("#editLessonPdfFile");
  if (editPdfFile) editPdfFile.value = "";
  if ($("#editLessonPdfName")) $("#editLessonPdfName").textContent = "Nenhum novo PDF selecionado";
  const pdfStatus = $("#editLessonPdfStatus");
  if (pdfStatus) { pdfStatus.hidden = true; pdfStatus.textContent = ""; }
  const removePdfStatus = $("#removePdfStatus");
  if (removePdfStatus) { removePdfStatus.hidden = true; removePdfStatus.textContent = ""; }
  const removePdfButton = $("#removeLessonPdf");
  if (removePdfButton) {
    removePdfButton.disabled = !Boolean(lesson.material_url?.trim());
    removePdfButton.textContent = "✕ Excluir PDF";
  }


  $("#editDuration").value =
    formatLessonDuration(lesson.duration_minutes);


  $("#editPublished").checked =
    lesson.published === true;


  $("#editLessonModal")
    .style.display =
      "flex";
}


/* ADICIONAR OU SUBSTITUIR VÍDEO EM AULA EXISTENTE */
const editLessonVideoFile = $("#editLessonVideoFile");
const editLessonVideoName = $("#editLessonVideoName");
$("#selectEditLessonVideo")?.addEventListener("click", () => editLessonVideoFile?.click());
editLessonVideoFile?.addEventListener("change", () => {
  const file = editLessonVideoFile.files?.[0];
  if (!file) {
    if (editLessonVideoName) editLessonVideoName.textContent = "Nenhum novo vídeo selecionado";
    return;
  }
  const allowed = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowed.includes(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) {
    alert("Selecione um vídeo MP4, WebM ou MOV.");
    editLessonVideoFile.value = "";
    if (editLessonVideoName) editLessonVideoName.textContent = "Nenhum novo vídeo selecionado";
    return;
  }
  if (editLessonVideoName) editLessonVideoName.textContent = file.name;
  detectSelectedVideoDuration(file, "#editDuration", "#editDurationAutoHint", "#editLessonVideoFile");
});

$("#detectEditVideoDuration")?.addEventListener("click", async () => {
  const button = $("#detectEditVideoDuration");
  const field = $("#editDuration"), hint = $("#editDurationAutoHint");
  const file = $("#editLessonVideoFile")?.files?.[0];
  const url = $("#editVideoUrl")?.value.trim();
  if (!file && !url) {
    if (hint) hint.textContent = "Selecione um vídeo ou informe sua URL para detectar a duração.";
    return;
  }
  button.disabled = true;
  const lessonId = $("#editLessonId")?.value;
  try {
    if (file) {
      await detectSelectedVideoDuration(file, "#editDuration", "#editDurationAutoHint", "#editLessonVideoFile");
    } else {
      if (hint) hint.textContent = "Lendo duração da URL...";
      const seconds = await window.LegionVideoDuration.read(url);
      if ($("#editLessonId")?.value !== lessonId || $("#editVideoUrl")?.value.trim() !== url) return;
      field.value = window.LegionVideoDuration.format(seconds);
      if (hint) hint.textContent = "Duração identificada: " + field.value + ". Você pode corrigir manualmente.";
    }
  } catch(error) {
    if (hint) hint.textContent = "Não foi possível detectar pela URL. Vídeos do YouTube e links sem metadados precisam de preenchimento manual.";
    console.warn("Duração indisponível pela URL:",error);
  } finally {
    button.disabled = false;
  }
});

/* ADICIONAR OU SUBSTITUIR PDF EM AULA EXISTENTE */
const editLessonPdfFile = $("#editLessonPdfFile");
const editLessonPdfName = $("#editLessonPdfName");
$("#selectEditLessonPdf")?.addEventListener("click", () => editLessonPdfFile?.click());
editLessonPdfFile?.addEventListener("change", () => {
  const file = editLessonPdfFile.files?.[0];
  if (!file) {
    if (editLessonPdfName) editLessonPdfName.textContent = "Nenhum novo PDF selecionado";
    return;
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    alert("Selecione apenas arquivos PDF.");
    editLessonPdfFile.value = "";
    if (editLessonPdfName) editLessonPdfName.textContent = "Nenhum novo PDF selecionado";
    return;
  }
  if (editLessonPdfName) editLessonPdfName.textContent = file.name;
});

async function uploadEditedLessonPdf(file) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new Error("O material precisa ser um PDF.");
  }
  const path = `${courseId}/${crypto.randomUUID()}.pdf`;
  const {error} = await sbA.storage.from("materiais").upload(path, file, {
    contentType:"application/pdf",
    upsert:false
  });
  if (error) throw error;
  return sbA.storage.from("materiais").getPublicUrl(path).data.publicUrl;
}

/* EXCLUIR SOMENTE O PDF SEM APAGAR A AULA */
$("#removeLessonPdf")?.addEventListener("click", async () => {
  const button = $("#removeLessonPdf");
  const lessonId = $("#editLessonId")?.value;
  if (!lessonId || button.disabled) return;
  const status = $("#removePdfStatus");
  const report = (text, error = false) => {
    if (!status) return;
    status.hidden = false;
    status.dataset.status = error ? "error" : "success";
    status.textContent = text;
  };
  const {data:lesson,error:readError} = await sbA.from("lessons")
    .select("id,material_url").eq("id",lessonId).maybeSingle();
  if (readError || !lesson) { report("Não foi possível verificar o PDF.",true); return; }
  if (!lesson.material_url) {
    $("#editMaterialUrl").value = "";
    button.disabled = true;
    report("Esta aula já está sem PDF.");
    return;
  }
  if (!confirm("Excluir o PDF desta aula? O vídeo e os demais dados serão preservados. Esta ação não pode ser desfeita.")) return;
  button.disabled = true;
  button.textContent = "Excluindo PDF...";
  try {
    const {data:updated,error:updateError}=await sbA.from("lessons")
      .update({material_url:null}).eq("id",lessonId).eq("material_url",lesson.material_url).select("id");
    if (updateError) throw updateError;
    if (!updated?.length) throw new Error("O material foi alterado. Abra a aula novamente.");
    $("#editMaterialUrl").value = "";
    if (editLessonPdfFile) editLessonPdfFile.value = "";
    if (editLessonPdfName) editLessonPdfName.textContent = "Nenhum novo PDF selecionado";
    button.disabled = true;
    button.textContent = "✕ Excluir PDF";
    msgA.textContent = "PDF desvinculado da aula.";
    await loadModules();

    let storagePath = null;
    try {
      const url = new URL(lesson.material_url);
      const projectHost = new URL(SUPABASE_URL).hostname;
      const storageHost = projectHost.replace(".supabase.co", ".storage.supabase.co");
      const prefix = "/storage/v1/object/public/materiais/";
      if ((url.hostname === projectHost || url.hostname === storageHost) && url.pathname.startsWith(prefix)) {
        const path = decodeURIComponent(url.pathname.slice(prefix.length));
        if (path.startsWith(courseId + "/") && !path.includes("..")) storagePath = path;
      }
    } catch (_) { /* PDF externo: desvincula mas não o apaga */ }

    if (storagePath) {
      const {count,error:refsError}=await sbA.from("lessons")
        .select("id",{count:"exact",head:true}).eq("material_url",lesson.material_url);
      if (refsError) {
        report("PDF removido da aula, mas o arquivo foi preservado por não ser possível verificar outras referências.",true);
        return;
      }
      if ((count || 0) === 0) {
        const {error:storageError}=await sbA.storage.from("materiais").remove([storagePath]);
        if (storageError) {
          report("PDF removido da aula. Não foi possível apagar o arquivo do armazenamento: " + storageError.message,true);
          return;
        }
        report("PDF excluído da aula e do armazenamento. O vídeo foi preservado.");
        return;
      }
    }
    report("PDF removido da aula. Arquivos externos ou utilizados em outras aulas são preservados.");
  } catch(e) {
    report("Não foi possível excluir o PDF: " + (e?.message || "Erro inesperado."),true);
    button.disabled = false;
    button.textContent = "✕ Excluir PDF";
  }
});

/* REMOVER SOMENTE O VÍDEO DA AULA */
const removeLessonVideoButton = $("#removeLessonVideo");
removeLessonVideoButton?.addEventListener("click", async () => {
  const lessonId = $("#editLessonId")?.value;
  if (!lessonId || removeLessonVideoButton.disabled) return;

  const statusElement = $("#removeVideoStatus");
  const showRemoveStatus = (text, isError = false) => {
    if (!statusElement) return;
    statusElement.hidden = false;
    statusElement.dataset.status = isError ? "error" : "success";
    statusElement.textContent = text;
  };

  // Reconsulta o vídeo realmente salvo antes de remover, evitando agir sobre uma URL não salva.
  const {data: lesson, error: lessonError} = await sbA
    .from("lessons").select("id,video_url").eq("id", lessonId).maybeSingle();
  if (lessonError || !lesson) {
    showRemoveStatus("Não foi possível verificar o vídeo desta aula.", true);
    return;
  }
  if (!lesson.video_url) {
    $("#editVideoUrl").value = "";
    removeLessonVideoButton.disabled = true;
    showRemoveStatus("Esta aula já está sem vídeo.");
    return;
  }
  if (!confirm("Excluir o vídeo desta aula? A aula, o PDF e o restante do conteúdo serão preservados. Esta ação não poderá ser desfeita.")) return;

  removeLessonVideoButton.disabled = true;
  removeLessonVideoButton.textContent = "Excluindo vídeo...";
  try {
    // Primeiro desvincula o vídeo da aula, para não manter uma URL quebrada.
    const {data:updated, error:updateError} = await sbA.from("lessons")
      .update({video_url:null})
      .eq("id", lessonId)
      .eq("video_url", lesson.video_url)
      .select("id");
    if (updateError) throw updateError;
    if (!updated?.length) throw new Error("O vídeo foi alterado em outra janela. Abra a aula novamente.");

    $("#editVideoUrl").value = "";
    removeLessonVideoButton.disabled = true;
    removeLessonVideoButton.textContent = "✕ Excluir vídeo";
    msgA.textContent = "Vídeo desvinculado da aula.";
    await loadModules();

    // Exclui do Storage apenas arquivos deste curso e do bucket videos.
    // URLs externas (YouTube, outros serviços) nunca são excluídas.
    let storagePath = null;
    try {
      const url = new URL(lesson.video_url);
      const projectHost = new URL(SUPABASE_URL).hostname;
      const storageHost = projectHost.replace(".supabase.co", ".storage.supabase.co");
      const prefix = "/storage/v1/object/public/videos/";
      if ((url.hostname === projectHost || url.hostname === storageHost) && url.pathname.startsWith(prefix)) {
        const candidate = decodeURIComponent(url.pathname.slice(prefix.length));
        if (candidate.startsWith(courseId + "/") && !candidate.includes("..")) storagePath = candidate;
      }
    } catch (_) { /* URL externa ou inválida: apenas desvinculada */ }

    if (storagePath) {
      const {count, error:refsError} = await sbA.from("lessons")
        .select("id", {count:"exact", head:true})
        .eq("video_url", lesson.video_url);
      if (refsError) {
        showRemoveStatus("Vídeo retirado da aula. Não foi possível verificar se o arquivo é usado em outras aulas, então ele foi preservado no armazenamento.", true);
        return;
      }
      if ((count || 0) === 0) {
        const {error:storageError} = await sbA.storage.from("videos").remove([storagePath]);
        if (storageError) {
          showRemoveStatus("Vídeo removido da aula, mas não foi possível apagar o arquivo do armazenamento: " + storageError.message, true);
          return;
        }
        showRemoveStatus("Vídeo excluído da aula e do armazenamento. Os outros materiais foram preservados.");
        return;
      }
    }
    showRemoveStatus("Vídeo removido da aula. O arquivo original foi preservado por ser externo ou estar em uso em outra aula.");
  } catch (error) {
    showRemoveStatus("Não foi possível excluir o vídeo: " + (error?.message || "Erro inesperado."), true);
    removeLessonVideoButton.disabled = false;
    removeLessonVideoButton.textContent = "✕ Excluir vídeo";
  }
});

/* SALVAR AULA E, SE SELECIONADO, ENVIAR NOVO VÍDEO */

$("#editLessonForm").addEventListener("submit", async event => {
  event.preventDefault();
  const lessonId = $("#editLessonId").value;
  const title = $("#editLessonTitle").value.trim();
  if (!title) {
    alert("Informe o título da aula.");
    return;
  }

  try {
    parseLessonDuration($("#editDuration").value);
  } catch (error) {
    alert(error.message);
    return;
  }

  const saveButton = $("#editLessonForm").querySelector('button[type="submit"]');
  if (saveButton.disabled) return;
  saveButton.disabled = true;
  const buttonContent = saveButton.innerHTML;
  saveButton.textContent = "Salvando aula...";

  const statusBox = $("#editLessonVideoStatus");
  const setEditStatus = (text, error = false) => {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.dataset.status = error ? "error" : "success";
    statusBox.textContent = text;
  };

  let newVideoUrl = $("#editVideoUrl").value.trim() || null;
  let newPdfUrl = $("#editMaterialUrl").value.trim() || null;
  try {
    const pdfFile = editLessonPdfFile?.files?.[0];
    if (pdfFile) {
      const pdfStatus = $("#editLessonPdfStatus");
      if (pdfStatus) { pdfStatus.hidden = false; pdfStatus.dataset.status = "success"; pdfStatus.textContent = "Enviando novo PDF..."; }
      newPdfUrl = await uploadEditedLessonPdf(pdfFile);
      if (pdfStatus) pdfStatus.textContent = "PDF enviado. Salvando a aula...";
    }
    const file = editLessonVideoFile?.files?.[0];
    if (file) {
      setEditStatus("Preparando novo vídeo...");
      newVideoUrl = await uploadLessonVideo(file, message => setEditStatus(message));
      setEditStatus("Vídeo enviado. Salvando as alterações da aula...");
    }

    const { error } = await sbA.from("lessons")
      .update({
        module_id: $("#editLessonModule").value,
        title,
        description: $("#editLessonDescription").value.trim(),
        video_url: newVideoUrl,
        material_url: newPdfUrl,
        duration_minutes: parseLessonDuration($("#editDuration").value),
        published: $("#editPublished").checked
      })
      .eq("id", lessonId);

    if (error) throw error;
    if (editLessonPdfFile) editLessonPdfFile.value = "";
    if (editLessonPdfName) editLessonPdfName.textContent = "Nenhum novo PDF selecionado";
    if (editLessonVideoFile) editLessonVideoFile.value = "";
    if (editLessonVideoName) editLessonVideoName.textContent = "Nenhum novo vídeo selecionado";
    closeLessonModal();
    msgA.textContent = file || pdfFile
      ? "Materiais enviados e aula atualizada com sucesso!"
      : "Aula atualizada com sucesso!";
    await loadModules();
  } catch (error) {
    console.error("Erro ao salvar vídeo ou aula:", error);
    const text = error?.message || "Erro inesperado.";
    const sizeProblem = /413|exceeded|max.*size|payload too large|entity too large|size limit/i.test(text);
    setEditStatus(sizeProblem
      ? "O arquivo ultrapassa o limite de tamanho do Supabase. Reduza o arquivo ou revise o limite do seu plano."
      : "Não foi possível salvar: " + text, true);
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = buttonContent;
  }
});


function closeLessonModal() {

  $("#editLessonModal")
    .style.display =
      "none";
}


$("#closeLessonModal").onclick =
  closeLessonModal;


$("#cancelLessonEdit").onclick =
  closeLessonModal;


$("#editLessonModal").onclick =
  event => {

    if (
      event.target ===
      $("#editLessonModal")
    ) {

      closeLessonModal();

    }

  };


/* =====================================
   EXCLUIR AULA
===================================== */

async function deleteLesson(
  lessonId,
  title
) {

  const confirmed =
    confirm(
      `Excluir a aula "${title}"?`
    );


  if (!confirmed) return;


  await sbA
    .from("lesson_progress")
    .delete()
    .eq(
      "lesson_id",
      lessonId
    );


  const {
    error
  } = await sbA
    .from("lessons")
    .delete()
    .eq(
      "id",
      lessonId
    );


  if (error) {

    alert(
      error.message
    );

    return;
  }


  msgA.textContent =
    "Aula excluída com sucesso!";


  await loadModules();
}


/* =====================================
   LOGOUT
===================================== */

$("#logout").onclick =
async () => {

  await sbA.auth.signOut();

  location.href =
    "index.html";
};


/* =====================================
   SEGURANÇA
===================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    character => ({

      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"

    }[character])
  );
}


function escapeAttribute(value) {

  return escapeHtml(value);
}


init();
