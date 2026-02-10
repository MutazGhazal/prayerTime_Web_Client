const { useEffect, useState } = React;

/* ========== Config ========== */
const config = window.CLIENT_CONFIG;
if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  document.getElementById("root").innerHTML =
    "<div class='auth-page'><div class='auth-card'><p>يرجى إنشاء ملف config.js</p></div></div>";
}
if (!window.supabase) {
  document.getElementById("root").innerHTML =
    "<div class='auth-page'><div class='auth-card'><p>تعذر تحميل Supabase</p></div></div>";
}
const supabase = window.supabase
  ? window.supabase.createClient(config?.SUPABASE_URL, config?.SUPABASE_ANON_KEY)
  : null;

/* ========== Helpers ========== */
let _itemId = 0;
const emptyItem = () => ({ _key: ++_itemId, title: "", body: "", image_url: "", link_url: "" });

/* ========== Toast System ========== */
let _toastList = [];
let _toastRender = null;
function showToast(msg, type = "success") {
  const id = Date.now();
  _toastList = [..._toastList, { id, msg, type }];
  if (_toastRender) _toastRender([..._toastList]);
  setTimeout(() => {
    _toastList = _toastList.filter((t) => t.id !== id);
    if (_toastRender) _toastRender([..._toastList]);
  }, 3000);
}
function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _toastRender = setToasts;
  if (!toasts.length) return null;
  return React.createElement("div", { className: "toast-container" },
    toasts.map((t) => React.createElement("div", { key: t.id, className: `toast ${t.type}` }, t.msg))
  );
}

/* ========== Google SVG ========== */
const GoogleIcon = () => React.createElement("svg", { viewBox: "0 0 24 24", width: 20, height: 20 },
  React.createElement("path", { d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z", fill: "#4285F4" }),
  React.createElement("path", { d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z", fill: "#34A853" }),
  React.createElement("path", { d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z", fill: "#FBBC05" }),
  React.createElement("path", { d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z", fill: "#EA4335" })
);

/* ========== Error Boundary ========== */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", { className: "card", style: { textAlign: "center", padding: 40, margin: 40 } },
        React.createElement("p", null, "حدث خطأ غير متوقع"),
        React.createElement("p", { className: "muted" }, String(this.state.error)),
        React.createElement("button", { className: "btn-save", onClick: () => this.setState({ hasError: false }) }, "إعادة المحاولة")
      );
    }
    return this.props.children;
  }
}

/* ========== Main App ========== */
function App() {
  const [session, setSession] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [client, setClient] = useState(null);
  const [section1, setSection1] = useState(emptyItem());
  const [links, setLinks] = useState([emptyItem()]);
  const [offers, setOffers] = useState([emptyItem()]);
  const [userItems, setUserItems] = useState([emptyItem()]);

  if (!supabase) return React.createElement("div", { className: "auth-page" }, React.createElement("div", { className: "auth-card" }, "تعذر تشغيل البوابة"));

  /* --- Auth --- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setAuthMsg({ type: "error", text: error.message });
      }).finally(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) { loadClientProfile(); loadUserSections(); } }, [session]);

  async function signIn() {
    setAuthBusy(true); setAuthMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (error) setAuthMsg({ type: "error", text: error.message });
  }

  async function signUp() {
    setAuthBusy(true); setAuthMsg(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setAuthBusy(false);
    if (error) { setAuthMsg({ type: "error", text: error.message }); return; }
    setAuthMsg({ type: "success", text: "تم إنشاء الحساب. تفقد بريدك لتأكيد التسجيل إن كان مطلوباً." });
  }

  async function signInWithGoogle() {
    setAuthBusy(true); setAuthMsg(null);
    const redirectTo = config?.WEB_CLIENT_URL || `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    setAuthBusy(false);
    if (error) { setAuthMsg({ type: "error", text: error.message }); return; }
    if (data?.url) window.location.href = data.url;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setClient(null); setUserItems([emptyItem()]);
  }

  /* --- Load --- */
  async function loadClientProfile() {
    const { data, error } = await supabase.from("client_users").select("client_id, clients (id, name, slug, logo_url)").single();
    if (!error && data?.clients) { setClient(data.clients); loadContent(data.clients); }
    else setClient(null);
  }

  async function loadContent(c) {
    const { data, error } = await supabase.from("client_sections").select("*").eq("client_slug", c.slug).order("sort_order", { ascending: true });
    if (error) { showToast(error.message, "error"); return; }
    const g = groupBySection(data || []);
    setSection1(g[1]?.[0] || emptyItem());
    setLinks(g[2] || [emptyItem()]);
    setOffers(g[3] || [emptyItem()]);
  }

  async function loadUserSections() {
    const uid = session?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase.from("app_user_sections").select("*").eq("user_id", uid).order("sort_order", { ascending: true });
    if (error) { showToast(error.message, "error"); return; }
    setUserItems((data || []).length ? data : [emptyItem()]);
  }

  /* --- Upload --- */
  async function uploadImage(file) {
    if (!client) return "";
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${client.slug}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(config.BUCKET).upload(path, file, { upsert: true });
      if (error) { showToast("خطأ رفع: " + error.message, "error"); return ""; }
      const { data } = supabase.storage.from(config.BUCKET).getPublicUrl(path);
      showToast("تم رفع الصورة ✓");
      return data.publicUrl;
    } finally { setUploading(false); }
  }

  async function uploadUserImage(file) {
    const uid = session?.user?.id;
    if (!uid) return "";
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `app-users/${uid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(config.BUCKET).upload(path, file, { upsert: true });
      if (error) { showToast("خطأ رفع: " + error.message, "error"); return ""; }
      const { data } = supabase.storage.from(config.BUCKET).getPublicUrl(path);
      showToast("تم رفع الصورة ✓");
      return data.publicUrl;
    } finally { setUploading(false); }
  }

  /* --- Save --- */
  async function saveSection(section, items) {
    if (!client) return;
    setSaving(true);
    try {
      await supabase.from("client_sections").delete().eq("client_slug", client.slug).eq("section", section);
      const payload = items.filter(i => i.title || i.body || i.image_url || i.link_url).map((i, idx) => ({
        client_id: client.id, client_slug: client.slug, section,
        title: i.title, body: i.body, image_url: i.image_url, link_url: i.link_url, sort_order: idx,
      }));
      if (payload.length) {
        const { error } = await supabase.from("client_sections").insert(payload);
        if (error) { showToast(error.message, "error"); return; }
      }
      showToast("تم الحفظ بنجاح ✓");
    } finally { setSaving(false); }
  }

  async function saveUserSection(items) {
    const uid = session?.user?.id;
    if (!uid) return;
    setSaving(true);
    try {
      await supabase.from("app_user_sections").delete().eq("user_id", uid);
      const payload = items.filter(i => i.title || i.body || i.image_url || i.link_url).map((i, idx) => ({
        user_id: uid, section: 1, title: i.title, body: i.body, image_url: i.image_url, link_url: i.link_url, sort_order: idx,
      }));
      if (payload.length) {
        const { error } = await supabase.from("app_user_sections").insert(payload);
        if (error) { showToast(error.message, "error"); return; }
      }
      showToast("تم حفظ المحتوى الخاص ✓");
    } finally { setSaving(false); }
  }

  function groupBySection(items) { return items.reduce((a, i) => { a[i.section] = a[i.section] || []; a[i.section].push(i); return a; }, {}); }
  function updateList(setter, list, idx, field, val) { const u = [...list]; u[idx] = { ...u[idx], [field]: val }; setter(u); }
  function addItem(setter, list) { setter([...list, emptyItem()]); }
  function removeItem(setter, list, idx) { const u = list.filter((_, i) => i !== idx); setter(u.length ? u : [emptyItem()]); }

  /* ===== LOGIN PAGE ===== */
  if (!session) {
    return (
      <div className="auth-page">
        <ToastContainer />
        <div className="auth-card">
          <div className="auth-logo">🕌</div>
          <div className="auth-title">بوابة العميل</div>
          <div className="auth-subtitle">سجّل دخولك لإدارة المحتوى والمشاركة</div>

          {authMsg && <div className={`alert ${authMsg.type}`}>{authMsg.text}</div>}

          <div className="auth-form">
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>كلمة المرور</label>
              <div className="pass-wrap">
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} />
                <button type="button" className="pass-toggle" onClick={() => setShowPass(p => !p)}>{showPass ? "إخفاء" : "عرض"}</button>
              </div>
            </div>
          </div>

          <div className="auth-actions">
            <button className="btn-primary" onClick={signIn} disabled={authBusy}>{authBusy ? "جاري الدخول..." : "تسجيل الدخول"}</button>
            <button className="btn-secondary" style={{ width: "100%", padding: 12, borderRadius: 12, fontSize: 14 }} onClick={signUp} disabled={authBusy}>إنشاء حساب جديد</button>
          </div>

          <div className="auth-divider">أو</div>

          <button className="btn-google" onClick={signInWithGoogle} disabled={authBusy}>
            <GoogleIcon />
            المتابعة عبر Google
          </button>
        </div>
      </div>
    );
  }

  /* ===== DASHBOARD ===== */
  return (
    <ErrorBoundary>
      <ToastContainer />
      <div className="app-header">
        <h1><span>🕌</span> بوابة {client?.name || "العميل"}</h1>
        <button className="btn-logout" onClick={signOut}>تسجيل الخروج ←</button>
      </div>
      <div className="container">

        {/* Welcome */}
        {client && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {client.logo_url && <img src={client.logo_url} alt="logo" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>مرحباً 👋</div>
              <div className="muted">أنت تدير محتوى: {client.name} ({client.slug})</div>
            </div>
          </div>
        )}

        {/* User Content */}
        <div className="card">
          <div className="card-title"><span className="icon">📝</span> محتوى المستخدم الخاص</div>
          <ListEditor items={userItems} setter={setUserItems} onUpload={uploadUserImage} uploading={uploading} />
          <div className="actions">
            <button className="btn-add" onClick={() => addItem(setUserItems, userItems)}>+ إضافة عنصر</button>
            <button className="btn-save" onClick={() => saveUserSection(userItems)} disabled={saving}>{saving ? "جاري الحفظ..." : "💾 حفظ المحتوى"}</button>
          </div>
        </div>

        {client && (
          <>
            {/* Company Info */}
            <div className="card">
              <div className="card-title"><span className="icon">🏢</span> بيانات الشركة</div>
              <ContentEditor item={section1} onChange={setSection1} onUpload={uploadImage} uploading={uploading} />
              <div className="actions"><button className="btn-save" onClick={() => saveSection(1, [section1])} disabled={saving}>{saving ? "جاري الحفظ..." : "💾 حفظ"}</button></div>
            </div>

            {/* Links */}
            <div className="card">
              <div className="card-title"><span className="icon">🔗</span> روابط الشركة</div>
              <ListEditor items={links} setter={setLinks} onUpload={uploadImage} uploading={uploading} />
              <div className="actions">
                <button className="btn-add" onClick={() => addItem(setLinks, links)}>+ إضافة رابط</button>
                <button className="btn-save" onClick={() => saveSection(2, links)} disabled={saving}>{saving ? "جاري الحفظ..." : "💾 حفظ الروابط"}</button>
              </div>
            </div>

            {/* Offers */}
            <div className="card">
              <div className="card-title"><span className="icon">🎁</span> عروض الشركة</div>
              <ListEditor items={offers} setter={setOffers} showImage onUpload={uploadImage} uploading={uploading} />
              <div className="actions">
                <button className="btn-add" onClick={() => addItem(setOffers, offers)}>+ إضافة عرض</button>
                <button className="btn-save" onClick={() => saveSection(3, offers)} disabled={saving}>{saving ? "جاري الحفظ..." : "💾 حفظ العروض"}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

/* ========== Content Editor (single) ========== */
function ContentEditor({ item, onChange, onUpload, uploading }) {
  return (
    <div>
      <div className="row">
        <div style={{ flex: 1 }}><label>العنوان</label><input value={item.title || ""} onChange={e => onChange({ ...item, title: e.target.value })} /></div>
        <div style={{ flex: 1 }}><label>رابط</label><input value={item.link_url || ""} onChange={e => onChange({ ...item, link_url: e.target.value })} placeholder="https://..." /></div>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>صورة</label>
        <div className="row">
          <div style={{ flex: 1 }}><input value={item.image_url || ""} onChange={e => onChange({ ...item, image_url: e.target.value })} placeholder="رابط الصورة أو ارفع ملف..." /></div>
          <div style={{ flex: 0 }}>
            <label className="btn-secondary" style={{ display: "inline-block", padding: "10px 16px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", fontSize: 13 }}>
              {uploading ? "جاري الرفع..." : "📷 رفع صورة"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const url = await onUpload(file);
                if (url) onChange({ ...item, image_url: url });
                e.target.value = "";
              }} />
            </label>
          </div>
        </div>
        {item.image_url && <div className="img-preview"><img src={item.image_url} alt="" onError={e => e.target.parentNode.style.display = "none"} /></div>}
      </div>
      <div style={{ marginTop: 8 }}><label>النص / الوصف</label><textarea value={item.body || ""} onChange={e => onChange({ ...item, body: e.target.value })} /></div>
    </div>
  );
}

/* ========== List Editor ========== */
function ListEditor({ items, setter, showBody = true, showImage = true, onUpload, uploading }) {
  return (
    <div>
      {items.map((item, index) => (
        <div className="list-item" key={item._key || index}>
          <div className="item-header">
            <span className="item-number">#{index + 1}</span>
            <button className="btn-danger" onClick={() => removeItem(setter, items, index)}>🗑 حذف</button>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}><label>العنوان</label><input value={item.title || ""} onChange={e => updateList(setter, items, index, "title", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label>رابط</label><input value={item.link_url || ""} onChange={e => updateList(setter, items, index, "link_url", e.target.value)} placeholder="https://..." /></div>
          </div>
          {showImage && (
            <div style={{ marginTop: 8 }}>
              <label>صورة</label>
              <div className="row">
                <div style={{ flex: 1 }}><input value={item.image_url || ""} onChange={e => updateList(setter, items, index, "image_url", e.target.value)} placeholder="رابط الصورة أو ارفع ملف..." /></div>
                {onUpload && (
                  <div style={{ flex: 0 }}>
                    <label className="btn-secondary" style={{ display: "inline-block", padding: "10px 16px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", fontSize: 13 }}>
                      {uploading ? "..." : "📷 رفع"}
                      <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const url = await onUpload(file);
                        if (url) updateList(setter, items, index, "image_url", url);
                        e.target.value = "";
                      }} />
                    </label>
                  </div>
                )}
              </div>
              {item.image_url && <div className="img-preview"><img src={item.image_url} alt="" onError={e => e.target.parentNode.style.display = "none"} /></div>}
            </div>
          )}
          {showBody && (
            <div style={{ marginTop: 8 }}><label>الوصف</label><textarea value={item.body || ""} onChange={e => updateList(setter, items, index, "body", e.target.value)} /></div>
          )}
        </div>
      ))}
    </div>
  );
}

function updateList(setter, list, idx, field, val) { const u = [...list]; u[idx] = { ...u[idx], [field]: val }; setter(u); }
function removeItem(setter, list, idx) { const u = list.filter((_, i) => i !== idx); setter(u.length ? u : [emptyItem()]); }

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
