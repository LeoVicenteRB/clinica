(function () {
  const STORAGE_KEY = "clinicSiteSettings";
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
  const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  let csrfToken = "";

  const defaultSettings = {
    siteTitle: "Clínica odontológica",
    metaDescription: "Clínica odontológica com atendimento humanizado, tecnologia e cuidado para toda a família.",
    clinicName: "Clínica",
    slogan: "Cuidando do seu sorriso com carinho, tecnologia e confiança.",
    heroTitle: "Sorrisos saudáveis começam com cuidado de verdade.",
    homeText:
      "Oferecemos atendimento odontológico humanizado para toda a família, unindo profissionais qualificados, estrutura confortável e cuidado em cada detalhe.",
    ctaText: "Agende sua avaliação",
    ctaHref: "https://wa.me/5511999999999?text=Olá!%20Quero%20agendar%20uma%20avaliação.",
    phone: "(11) 9999-9999",
    whatsapp: "(11) 99999-9999",
    email: "contato@clinica.com.br",
    hours: "Segunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.",
    address: "Av. Brasil, 1000 - Centro, São Paulo - SP",
    mapsLink: "https://www.google.com/maps",
    mapsEmbed:
      '<iframe src="https://www.google.com/maps?q=Av.%20Brasil%201000%20Centro%20Sao%20Paulo&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>',
    heroImage: "./assets/clinic-hero.png",
    aboutTitle: "Sobre a clínica",
    aboutText:
      "Somos uma clínica odontológica focada em acolhimento, prevenção e tratamentos personalizados. Nosso compromisso é tornar cada consulta mais tranquila, clara e segura.",
    mission: "Cuidar da saúde bucal com excelência, respeito e atenção aos detalhes.",
    vision: "Ser referência em odontologia humanizada e acessível na região.",
    values: "Ética, acolhimento, transparência, tecnologia e compromisso com o paciente.",
    aboutImage: "./assets/clinic-hero.png",
    theme: {
      ink: "#17313b",
      muted: "#5c727b",
      line: "#dbe8e9",
      paper: "#ffffff",
      soft: "#f5fbfa",
      aqua: "#35c5b2",
      blue: "#4d8fcb",
      green: "#7acb84",
      coral: "#ff8f70"
    },
    highlights: [
      { title: "Atendimento humanizado", description: "Escuta ativa e orientação clara em cada etapa." },
      { title: "Profissionais qualificados", description: "Equipe preparada para diferentes necessidades." },
      { title: "Tecnologia e conforto", description: "Ambiente moderno para consultas mais tranquilas." },
      { title: "Localização acessível", description: "Fácil acesso para rotina, família e trabalho." }
    ],
    differentials: [
      { title: "Atendimento humanizado", description: "Acolhimento desde o primeiro contato." },
      { title: "Ambiente moderno", description: "Estrutura leve, limpa e confortável." },
      { title: "Especialistas", description: "Planejamento cuidadoso para cada caso." },
      { title: "Tratamentos personalizados", description: "Condutas alinhadas com o seu objetivo." },
      { title: "Fácil acesso", description: "Localização prática para o dia a dia." }
    ],
    carouselImages: [
      {
        src: "./assets/clinic-hero.png",
        title: "Recepção acolhedora",
        description: "Um primeiro contato leve, organizado e confortável."
      },
      {
        src: "./assets/clinic-hero.png",
        title: "Consultórios modernos",
        description: "Tecnologia e cuidado para tratamentos mais seguros."
      },
      {
        src: "./assets/clinic-hero.png",
        title: "Cuidado para toda a família",
        description: "Atendimento claro, preventivo e humanizado."
      }
    ]
  };

  let settings = loadSettings();
  let carouselIndex = 0;

  function loadSettings() {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...defaultSettings };
    }
  }

  async function saveSettings() {
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify(settings)
      });
      if (response.status === 401) return { ok: false, unauthorized: true };
      if (!response.ok) throw new Error("Falha ao salvar no servidor.");
      const payload = await response.json();
      settings = { ...defaultSettings, ...payload.settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return { ok: true, localOnly: false };
    } catch (error) {
      console.warn("Usando persistência local:", error);
      if (location.protocol === "file:") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return { ok: true, localOnly: true };
      }
      return { ok: false, error };
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function sanitizeText(value) {
    return String(value || "");
  }

  function updateBindings() {
    applyTheme();
    updatePageMetadata();
    document.querySelectorAll("[data-bind]").forEach((el) => {
      const key = el.dataset.bind;
      el.textContent = sanitizeText(settings[key]);
    });

    document.querySelectorAll("[data-bind-attr]").forEach((el) => {
      el.dataset.bindAttr.split(",").forEach((pair) => {
        const [key, attr] = pair.split(":").map((item) => item.trim());
        if (settings[key]) el.setAttribute(attr, settings[key]);
      });
    });

    const phoneHref = document.querySelectorAll('[data-bind-attr*="phoneHref"]');
    phoneHref.forEach((el) => el.href = `tel:${onlyDigits(settings.phone)}`);
    const emailHref = document.querySelectorAll('[data-bind-attr*="emailHref"]');
    emailHref.forEach((el) => el.href = `mailto:${settings.email}`);
    const whatsappHref = document.querySelectorAll('[data-bind-attr*="whatsappHref"]');
    whatsappHref.forEach((el) => el.href = whatsappUrl("Olá! Quero agendar uma avaliação."));

    renderCardList("highlights", ".quick-highlights");
    renderCardList("differentials", ".feature-grid");
    renderMap();
    renderCarousel();
  }

  function updatePageMetadata() {
    const title = sanitizeText(settings.siteTitle || settings.clinicName || defaultSettings.siteTitle);
    const description = sanitizeText(settings.metaDescription || defaultSettings.metaDescription);
    const suffix = isAdminRoute() ? " | Admin" : "";
    document.title = `${title}${suffix}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelectorAll("[data-brand-mark]").forEach((el) => {
      const cleanName = sanitizeText(settings.clinicName || settings.siteTitle || "C").trim();
      el.textContent = cleanName ? cleanName.charAt(0).toUpperCase() : "C";
    });
  }

  function renderCardList(key, selector) {
    const root = document.querySelector(selector);
    if (!root) return;
    root.innerHTML = "";
    settings[key].forEach((item) => {
      const article = document.createElement("article");
      article.innerHTML = `<strong></strong><p></p>`;
      article.querySelector("strong").textContent = item.title;
      article.querySelector("p").textContent = item.description;
      root.appendChild(article);
    });
  }

  function renderMap() {
    const container = document.querySelector("[data-map-container]");
    if (!container) return;
    if (settings.mapsEmbed && settings.mapsEmbed.includes("<iframe")) {
      container.innerHTML = settings.mapsEmbed;
    } else {
      container.innerHTML = `<div class="map-placeholder"><p>${settings.address}</p></div>`;
    }
  }

  function renderCarousel() {
    const track = document.querySelector("[data-carousel-track]");
    const dots = document.querySelector("[data-carousel-dots]");
    if (!track || !dots) return;
    const items = settings.carouselImages.length ? settings.carouselImages : defaultSettings.carouselImages;
    carouselIndex = Math.min(carouselIndex, items.length - 1);
    track.innerHTML = "";
    dots.innerHTML = "";
    items.forEach((item, index) => {
      const slide = document.createElement("article");
      slide.className = "carousel-slide";
      slide.innerHTML = `<img alt=""><div class="carousel-caption"><h3></h3><p></p></div>`;
      slide.querySelector("img").src = item.src;
      slide.querySelector("img").alt = item.title || "Imagem da clínica";
      slide.querySelector("h3").textContent = item.title || "";
      slide.querySelector("p").textContent = item.description || "";
      track.appendChild(slide);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = index === carouselIndex ? "active" : "";
      dot.setAttribute("aria-label", `Ir para imagem ${index + 1}`);
      dot.addEventListener("click", () => setCarousel(index));
      dots.appendChild(dot);
    });
    track.style.transform = `translateX(-${carouselIndex * 100}%)`;
  }

  function setCarousel(index) {
    const total = settings.carouselImages.length || 1;
    carouselIndex = (index + total) % total;
    renderCarousel();
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function whatsappUrl(message) {
    const number = onlyDigits(settings.whatsapp || settings.phone);
    return `https://wa.me/55${number.replace(/^55/, "")}?text=${encodeURIComponent(message)}`;
  }

  function setupPublicInteractions() {
    const navToggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector(".main-nav");
    navToggle?.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
    nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => nav.classList.remove("open")));
    document.querySelector(".carousel-control.prev")?.addEventListener("click", () => setCarousel(carouselIndex - 1));
    document.querySelector(".carousel-control.next")?.addEventListener("click", () => setCarousel(carouselIndex + 1));
    byId("contactForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const message = [
        `Olá! Gostaria de falar com ${settings.clinicName || "a clínica"}.`,
        `Nome: ${data.get("name")}`,
        `Telefone: ${data.get("phone")}`,
        `E-mail: ${data.get("email") || "Não informado"}`,
        `Mensagem: ${data.get("message")}`
      ].join("\n");
      window.open(whatsappUrl(message), "_blank", "noopener");
    });
    window.setInterval(() => {
      if (!document.hidden && byId("publicApp") && !byId("publicApp").hidden) {
        setCarousel(carouselIndex + 1);
      }
    }, 6000);
  }

  function isAdminRoute() {
    if (location.hash === "#admin") {
      location.href = "/admin/";
      return false;
    }
    return location.pathname === "/admin" || location.pathname === "/admin/" || location.pathname.startsWith("/admin/");
  }

  async function setupAdmin() {
    if (!isAdminRoute()) return;
    byId("publicApp").hidden = true;
    byId("adminApp").hidden = false;
    byId("adminLogin").hidden = true;
    byId("adminDashboard").hidden = true;

    if (await checkAdminSession()) {
      showDashboard();
    } else {
        if (location.pathname.includes("/painel")) {
          location.href = "/admin/";
        return;
      }
      showLogin();
    }

    byId("loginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      byId("loginFeedback").textContent = "";
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: data.get("user"),
            password: data.get("password")
          })
        });
        if (!response.ok) throw new Error("Usuário ou senha inválidos.");
        const payload = await response.json();
        csrfToken = payload.csrfToken || "";
        if (location.pathname.startsWith("/admin") && !location.pathname.includes("/painel")) {
          location.href = "/admin/painel";
          return;
        }
        showDashboard();
      } catch (error) {
        byId("loginFeedback").textContent = error.message || "Não foi possível fazer login.";
      }
    });

    byId("logoutBtn")?.addEventListener("click", async () => {
      try {
        await fetch("/api/logout", { method: "POST" });
      } finally {
        showLogin();
      }
    });
    byId("saveAllBtn")?.addEventListener("click", saveFromAdmin);
    byId("settingsForm")?.addEventListener("input", handleLiveFormChange);
    document.querySelectorAll("[data-upload]").forEach((input) => input.addEventListener("change", handleSingleImageUpload));
    byId("carouselUpload")?.addEventListener("change", handleCarouselUpload);
    document.querySelectorAll(".admin-tabs button").forEach((button) => {
      button.addEventListener("click", () => switchAdminTab(button.dataset.tab));
    });
  }

  function showDashboard() {
    byId("adminLogin").hidden = true;
    byId("adminDashboard").hidden = false;
    fillAdminForm();
    renderEditors();
    loadUsers();
  }

  function showLogin() {
    if (location.pathname.includes("/painel")) {
      location.href = "/admin/";
      return;
    }
    byId("adminLogin").hidden = false;
    byId("adminDashboard").hidden = true;
  }

  async function checkAdminSession() {
    try {
      const response = await fetch("/api/me", { headers: { Accept: "application/json" } });
      if (!response.ok) return false;
      const payload = await response.json();
      csrfToken = payload.csrfToken || "";
      return Boolean(payload.authenticated);
    } catch {
      return false;
    }
  }

  function fillAdminForm() {
    const form = byId("settingsForm");
    Object.keys(defaultSettings).forEach((key) => {
      const field = form.querySelector(`[name="${key}"]`);
      if (field && typeof settings[key] !== "object") field.value = settings[key] || "";
    });
    Object.entries({ ...defaultSettings.theme, ...(settings.theme || {}) }).forEach(([key, value]) => {
      const field = form.querySelector(`[name="theme.${key}"]`);
      if (field) field.value = value;
    });
  }

  function handleLiveFormChange(event) {
    const field = event.target;
    if (!field.name || field.type === "file") return;
    if (field.name.startsWith("theme.")) {
      const key = field.name.replace("theme.", "");
      settings.theme = { ...(settings.theme || defaultSettings.theme), [key]: field.value };
    } else {
      settings[field.name] = field.value;
    }
    updateBindings();
  }

  async function saveFromAdmin() {
    const form = byId("settingsForm");
    form.querySelectorAll('[data-panel="geral"] [name], [data-panel="sobre"] [name], [data-panel="aparencia"] [name]').forEach((field) => {
      if (field.type !== "file" && field.name in settings && typeof settings[field.name] !== "object") {
        settings[field.name] = field.value;
      }
      if (field.name.startsWith("theme.")) {
        const key = field.name.replace("theme.", "");
        settings.theme = { ...(settings.theme || defaultSettings.theme), [key]: field.value };
      }
    });
    collectListEditor("highlights", "highlightsEditor");
    collectListEditor("differentials", "differentialsEditor");
    collectCarouselEditor();
    const saveResult = await saveSettings();
    updateBindings();
    renderEditors();
    if (saveResult.ok && !saveResult.localOnly) notify("Alterações salvas no banco de dados.");
    if (saveResult.ok && saveResult.localOnly) notify("Alterações salvas apenas neste navegador.");
    if (!saveResult.ok && saveResult.unauthorized) {
      notify("Faça login novamente para salvar as alterações.", true);
      showLogin();
    }
    if (!saveResult.ok && !saveResult.unauthorized) notify("Não foi possível salvar no servidor.", true);
  }

  function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tabs button").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tab);
    });
    if (tab === "usuarios") loadUsers();
  }

  function renderEditors() {
    renderListEditor("highlights", "highlightsEditor");
    renderListEditor("differentials", "differentialsEditor");
    renderCarouselEditor();
  }

  function renderListEditor(key, elementId) {
    const root = byId(elementId);
    if (!root) return;
    root.innerHTML = "";
    settings[key].forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.dataset.index = String(index);
      row.innerHTML = `
        <label>Título<input data-field="title" value=""></label>
        <label>Descrição<input data-field="description" value=""></label>
        <div class="row-actions">
          <button class="icon-btn" type="button" data-action="up" title="Subir">↑</button>
          <button class="icon-btn" type="button" data-action="down" title="Descer">↓</button>
          <button class="icon-btn" type="button" data-action="remove" title="Remover">×</button>
        </div>`;
      row.querySelector('[data-field="title"]').value = item.title;
      row.querySelector('[data-field="description"]').value = item.description;
      root.appendChild(row);
    });
    const add = document.createElement("button");
    add.className = "btn ghost";
    add.type = "button";
    add.textContent = "Adicionar item";
    add.addEventListener("click", () => {
      collectListEditor(key, elementId);
      settings[key].push({ title: "Novo item", description: "Descrição do diferencial." });
      renderListEditor(key, elementId);
      updateBindings();
    });
    root.appendChild(add);
    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleListAction(key, elementId, button));
    });
  }

  function collectListEditor(key, elementId) {
    const root = byId(elementId);
    if (!root) return;
    settings[key] = Array.from(root.querySelectorAll(".list-row")).map((row) => ({
      title: row.querySelector('[data-field="title"]').value,
      description: row.querySelector('[data-field="description"]').value
    }));
  }

  function handleListAction(key, elementId, button) {
    collectListEditor(key, elementId);
    const index = Number(button.closest(".list-row").dataset.index);
    const action = button.dataset.action;
    if (action === "remove") {
      if (!confirm("Remover este item?")) return;
      settings[key].splice(index, 1);
    }
    if (action === "up" && index > 0) {
      [settings[key][index - 1], settings[key][index]] = [settings[key][index], settings[key][index - 1]];
    }
    if (action === "down" && index < settings[key].length - 1) {
      [settings[key][index + 1], settings[key][index]] = [settings[key][index], settings[key][index + 1]];
    }
    renderListEditor(key, elementId);
    updateBindings();
  }

  function renderCarouselEditor() {
    const root = byId("carouselEditor");
    if (!root) return;
    root.innerHTML = "";
    settings.carouselImages.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "carousel-row";
      row.dataset.index = String(index);
      row.innerHTML = `
        <img alt="">
        <div class="form-grid">
          <label>Título<input data-field="title" value=""></label>
          <label>Descrição<input data-field="description" value=""></label>
        </div>
        <div class="row-actions">
          <button class="icon-btn" type="button" data-action="up" title="Subir">↑</button>
          <button class="icon-btn" type="button" data-action="down" title="Descer">↓</button>
          <button class="icon-btn" type="button" data-action="remove" title="Remover">×</button>
        </div>`;
      row.querySelector("img").src = item.src;
      row.querySelector("img").alt = item.title || "Imagem do carrossel";
      row.querySelector('[data-field="title"]').value = item.title || "";
      row.querySelector('[data-field="description"]').value = item.description || "";
      root.appendChild(row);
    });
    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleCarouselAction(button));
    });
  }

  function collectCarouselEditor() {
    const root = byId("carouselEditor");
    if (!root) return;
    settings.carouselImages = Array.from(root.querySelectorAll(".carousel-row")).map((row) => {
      const previous = settings.carouselImages[Number(row.dataset.index)];
      return {
        src: previous.src,
        title: row.querySelector('[data-field="title"]').value,
        description: row.querySelector('[data-field="description"]').value
      };
    });
  }

  function handleCarouselAction(button) {
    collectCarouselEditor();
    const index = Number(button.closest(".carousel-row").dataset.index);
    const action = button.dataset.action;
    if (action === "remove") {
      if (!confirm("Remover esta imagem?")) return;
      settings.carouselImages.splice(index, 1);
    }
    if (action === "up" && index > 0) {
      [settings.carouselImages[index - 1], settings.carouselImages[index]] = [
        settings.carouselImages[index],
        settings.carouselImages[index - 1]
      ];
    }
    if (action === "down" && index < settings.carouselImages.length - 1) {
      [settings.carouselImages[index + 1], settings.carouselImages[index]] = [
        settings.carouselImages[index],
        settings.carouselImages[index + 1]
      ];
    }
    renderCarouselEditor();
    updateBindings();
  }

  function handleSingleImageUpload(event) {
    const field = event.target.dataset.upload;
    const file = event.target.files[0];
    if (!field || !file) return;
    readImage(file)
      .then((src) => {
        settings[field] = src;
        updateBindings();
        notify("Imagem atualizada. Clique em salvar para manter a alteração.");
      })
      .catch((error) => notify(error.message, true));
  }

  function handleCarouselUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    readImage(file)
      .then((src) => {
        collectCarouselEditor();
        settings.carouselImages.push({
          src,
          title: "Nova imagem",
          description: "Edite a descrição desta imagem."
        });
        renderCarouselEditor();
        updateBindings();
        notify("Imagem adicionada. Clique em salvar para manter a alteração.");
      })
      .catch((error) => notify(error.message, true))
      .finally(() => {
        event.target.value = "";
      });
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        reject(new Error("Formato inválido. Use jpg, jpeg, png ou webp."));
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        reject(new Error("Imagem muito grande. O limite é 2 MB."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
      reader.readAsDataURL(file);
    });
  }

  function notify(message, isError) {
    const box = byId("adminFeedback");
    if (!box) return;
    box.textContent = message;
    box.style.color = isError ? "#b3261e" : "#1d6c3f";
    box.style.background = isError ? "#fdeceb" : "#e8f7ed";
    box.classList.add("show");
    window.setTimeout(() => box.classList.remove("show"), 3500);
  }

  function applyTheme() {
    const theme = { ...defaultSettings.theme, ...(settings.theme || {}) };
    Object.entries(theme).forEach(([key, value]) => {
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        document.documentElement.style.setProperty(`--${key}`, value);
      }
    });
  }

  async function loadUsers() {
    const root = byId("usersList");
    if (!root) return;
    try {
      const response = await fetch("/api/users", { headers: { Accept: "application/json" } });
      if (response.status === 401) {
        showLogin();
        return;
      }
      if (!response.ok) throw new Error("Não foi possível carregar usuários.");
      const payload = await response.json();
      renderUsers(payload.users || []);
    } catch (error) {
      root.innerHTML = `<p>${error.message || "Erro ao carregar usuários."}</p>`;
    }
  }

  function renderUsers(users) {
    const root = byId("usersList");
    if (!root) return;
    root.innerHTML = "";
    users.forEach((user) => {
      const row = document.createElement("div");
      row.className = "user-row";
      row.innerHTML = `
        <div>
          <strong></strong>
          <span></span>
        </div>
        <button class="icon-btn" type="button" title="Remover usuário">×</button>
      `;
      row.querySelector("strong").textContent = user.username;
      row.querySelector("span").textContent = user.displayName || "Sem nome";
      row.querySelector("button").addEventListener("click", () => removeUser(user.username));
      root.appendChild(row);
    });
  }

  async function createAdminUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          username: data.get("username"),
          displayName: data.get("displayName"),
          password: data.get("password")
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Não foi possível criar usuário.");
      }
      form.reset();
      notify("Usuário criado com sucesso.");
      loadUsers();
    } catch (error) {
      notify(error.message || "Não foi possível criar usuário.", true);
    }
  }

  async function removeUser(username) {
    if (!confirm(`Remover o usuário ${username}?`)) return;
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Não foi possível remover usuário.");
      }
      notify("Usuário removido.");
      loadUsers();
    } catch (error) {
      notify(error.message || "Não foi possível remover usuário.", true);
    }
  }

  async function syncSettingsFromApi() {
    try {
      const response = await fetch("/api/settings", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("API indisponível.");
      settings = { ...defaultSettings, ...(await response.json()) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      updateBindings();
      if (isAdminRoute() && !byId("adminDashboard").hidden) {
        fillAdminForm();
        renderEditors();
      }
    } catch (error) {
      console.warn("Configurações carregadas do navegador:", error);
    }
  }

  updateBindings();
  setupPublicInteractions();
  setupAdmin();
  byId("userForm")?.addEventListener("submit", createAdminUser);
  syncSettingsFromApi();
})();
