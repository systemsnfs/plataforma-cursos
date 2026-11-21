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

            <div class="premium-lessons">

              ${
                lessons.length

                  ? lessons
                      .map(
                        (lesson, lessonIndex) =>
                          renderLesson(
                            lesson,
                            lessonIndex
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
}
/* =====================================
   MOSTRAR AULA
===================================== */

function renderLesson(
  lesson,
  lessonIndex
) {

  const lessonNumber =
    String(lessonIndex + 1)
      .padStart(2, "0");


  const duration =
    Number(
      lesson.duration_minutes || 0
    );


  return `

    <div class="premium-lesson-row">


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
            ${duration === 1 ? "minuto" : "minutos"}
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
});
async function uploadLessonVideo() {
  const file = lessonVideo?.files?.[0];
  if (!file) return null;
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type) &&
      !/\.(mp4|webm|mov)$/i.test(file.name)) {
    throw new Error("Selecione um vídeo MP4, WebM ou MOV.");
  }
  const extension = file.name.split(".").pop().toLowerCase();
  const path = `${courseId}/${crypto.randomUUID()}.${extension}`;
  const mime = file.type || (extension === "mov" ? "video/quicktime" : `video/${extension}`);
  const { error } = await sbA.storage.from("videos").upload(path, file, {
    contentType: mime,
    upsert: false
  });
  if (error) throw error;
  return sbA.storage.from("videos").getPublicUrl(path).data.publicUrl;
}

/* =====================================
   CRIAR AULA
===================================== */

lessonForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const moduleId =
      moduleSelect.value;


    if (!moduleId) {

      alert(
        "Crie um módulo primeiro."
      );

      return;
    }


    const title =
      $("#lessonTitle")
        .value
        .trim();


    if (!title) {

      alert(
        "Informe o título da aula."
      );

      return;
    }

let materialUrl = null;
    let videoUrl = null;
    const submitButton = lessonForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      msgA.textContent = "Enviando arquivos...";
      materialUrl = await uploadLessonPdf();
      videoUrl = await uploadLessonVideo();
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      msgA.textContent = "Erro no envio: " + error.message;
      if (submitButton) submitButton.disabled = false;
      return;
    }
    const {
      count
    } = await sbA
      .from("lessons")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq(
        "module_id",
        moduleId
      );


    const {
      error
    } = await sbA
      .from("lessons")
      .insert({

        module_id:
          moduleId,

        title,

        description:
          $("#lessonDescription")
            .value
            .trim(),

        video_url: videoUrl,

        material_url:
  materialUrl,

        duration_minutes:
          Number(
            $("#duration")
              .value || 0
          ),

        position:
          (count || 0) + 1,

        published:
          true

      });


    if (error) {
      msgA.textContent = error.message;
      if (submitButton) submitButton.disabled = false;
      return;
    }

    if (submitButton) submitButton.disabled = false;
    lessonForm.reset();
    closeCreateLessonModal();
if (pdfFileName) pdfFileName.textContent = "Nenhum PDF selecionado";
if (videoFileName) videoFileName.textContent = "Nenhum vídeo selecionado";

    msgA.textContent =
      "Aula criada com sucesso!";


    await loadModules();
  }
);


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


  $("#editMaterialUrl").value =
    lesson.material_url || "";


  $("#editDuration").value =
    lesson.duration_minutes || 0;


  $("#editPublished").checked =
    lesson.published === true;


  $("#editLessonModal")
    .style.display =
      "flex";
}


/* SALVAR AULA */

$("#editLessonForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const lessonId =
        $("#editLessonId")
          .value;


      const title =
        $("#editLessonTitle")
          .value
          .trim();


      if (!title) {

        alert(
          "Informe o título da aula."
        );

        return;
      }


      const {
        error
      } = await sbA
        .from("lessons")
        .update({

          module_id:
            $("#editLessonModule")
              .value,

          title,

          description:
            $("#editLessonDescription")
              .value
              .trim(),

          video_url:
            $("#editVideoUrl")
              .value
              .trim() || null,

          material_url:
            $("#editMaterialUrl")
              .value
              .trim() || null,

          duration_minutes:
            Number(
              $("#editDuration")
                .value || 0
            ),

          published:
            $("#editPublished")
              .checked

        })
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


      closeLessonModal();


      msgA.textContent =
        "Aula atualizada com sucesso!";


      await loadModules();
    }
  );


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
