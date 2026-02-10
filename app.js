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
let _setToasts = null;
function showToast(msg, type) {
  if (!type) type = "success";
  const id = Date.now();
  _toastList = _toastList.concat([{ id: id, msg: msg, type: type }]);
  if (_setToasts) _setToasts(_toastList.slice());
  setTimeout(function() {
    _toastList = _toastList.filter(function(t) { return t.id !== id; });
    if (_setToasts) _setToasts(_toastList.slice());
  }, 3000);
}
function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(function(t) {
        return <div key={t.id} className={"toast " + t.type}>{t.msg}</div>;
      })}
    </div>
  );
}

/* ========== Google Icon ========== */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* ========== Error Boundary ========== */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ textAlign: "center", padding: 40, margin: 40 }}>
          <p>حدث خطأ غير متوقع</p>
          <p className="muted">{String(this.state.error)}</p>
          <button className="btn-save" onClick={() => this.setState({ hasError: false })}>إعادة المحاولة</button>
        </div>
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

  if (!supabase) {
    return <div className="auth-page"><div className="auth-card">تعذر تشغيل البوابة</div></div>;
  }

  useEffect(function() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(function(res) {
        if (res.error) setAuthMsg({ type: "error", text: res.error.message });
      }).finally(function() {
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
    supabase.auth.getSession().then(function(res) { setSession(res.data.session); });
    var sub = supabase.auth.onAuthStateChange(function(_e, s) { setSession(s); });
    return function() { sub.data.subscription.unsubscribe(); };
  }, []);

  useEffect(function() { if (session) { loadClientProfile(); loadUserSections(); } }, [session]);

  async function signIn() {
    setAuthBusy(true); setAuthMsg(null);
    var res = await supabase.auth.signInWithPassword({ email: email, password: password });
    setAuthBusy(false);
    if (res.error) setAuthMsg({ type: "error", text: res.error.message });
  }

  async function signUp() {
    setAuthBusy(true); setAuthMsg(null);
    var res = await supabase.auth.signUp({ email: email, password: password });
    setAuthBusy(false);
    if (res.error) { setAuthMsg({ type: "error", text: res.error.message }); return; }
    setAuthMsg({ type: "success", text: "تم إنشاء الحساب. تفقد بريدك لتأكيد التسجيل إن كان مطلوباً." });
  }

  async function signInWithGoogle() {
    setAuthBusy(true); setAuthMsg(null);
    var redirectTo = config.WEB_CLIENT_URL || (window.location.origin + window.location.pathname);
    var res = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo, skipBrowserRedirect: true },
    });
    setAuthBusy(false);
    if (res.error) { setAuthMsg({ type: "error", text: res.error.message }); return; }
    if (res.data && res.data.url) window.location.href = res.data.url;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setClient(null); setUserItems([emptyItem()]);
  }

  async function loadClientProfile() {
    var res = await supabase.from("client_users").select("client_id, clients (id, name, slug, logo_url)").single();
    if (!res.error && res.data && res.data.clients) { setClient(res.data.clients); loadContent(res.data.clients); }
    else setClient(null);
  }

  async function loadContent(c) {
    var res = await supabase.from("client_sections").select("*").eq("client_slug", c.slug).order("sort_order", { ascending: true });
    if (res.error) { showToast(res.error.message, "error"); return; }
    var g = groupBySection(res.data || []);
    setSection1(g[1] && g[1][0] ? g[1][0] : emptyItem());
    setLinks(g[2] || [emptyItem()]);
    setOffers(g[3] || [emptyItem()]);
  }

  async function loadUserSections() {
    var uid = session && session.user ? session.user.id : null;
    if (!uid) return;
    var res = await supabase.from("app_user_sections").select("*").eq("user_id", uid).order("sort_order", { ascending: true });
    if (res.error) { showToast(res.error.message, "error"); return; }
    setUserItems((res.data || []).length ? res.data : [emptyItem()]);
  }

  async function uploadImage(file) {
    if (!client) return "";
    setUploading(true);
    try {
      var ext = file.name.split(".").pop();
      var path = client.slug + "/" + Date.now() + "." + ext;
      var res = await supabase.storage.from(config.BUCKET).upload(path, file, { upsert: true });
      if (res.error) { showToast("خطأ رفع: " + res.error.message, "error"); return ""; }
      var urlRes = supabase.storage.from(config.BUCKET).getPublicUrl(path);
      showToast("تم رفع الصورة ✓");
      return urlRes.data.publicUrl;
    } finally { setUploading(false); }
  }

  async function uploadUserImage(file) {
    var uid = session && session.user ? session.user.id : null;
    if (!uid) return "";
    setUploading(true);
    try {
      var ext = file.name.split(".").pop();
      var path = "app-users/" + uid + "/" + Date.now() + "." + ext;
      var res = await supabase.storage.from(config.BUCKET).upload(path, file, { upsert: true });
      if (res.error) { showToast("خطأ رفع: " + res.error.message, "error"); return ""; }
      var urlRes = supabase.storage.from(config.BUCKET).getPublicUrl(path);
      showToast("تم رفع الصورة ✓");
      return urlRes.data.publicUrl;
    } finally { setUploading(false); }
  }

  async function saveSection(section, items) {
    if (!client) return;
    setSaving(true);
    try {
      await supabase.from("client_sections").delete().eq("client_slug", client.slug).eq("section", section);
      var payload = [];
      for (var idx = 0; idx < items.length; idx++) {
        var i = items[idx];
        if (i.title || i.body || i.image_url || i.link_url) {
          payload.push({ client_id: client.id, client_slug: client.slug, section: section, title: i.title, body: i.body, image_url: i.image_url, link_url: i.link_url, sort_order: idx });
        }
      }
      if (payload.length) { var res = await supabase.from("client_sections").insert(payload); if (res.error) { showToast(res.error.message, "error"); return; } }
      showToast("تم الحفظ بنجاح ✓");
    } finally { setSaving(false); }
  }

  async function saveUserSection(items) {
    var uid = session && session.user ? session.user.id : null;
    if (!uid) return;
    setSaving(true);
    try {
      await supabase.from("app_user_sections").delete().eq("user_id", uid);
      var payload = [];
      for (var idx = 0; idx < items.length; idx++) {
        var i = items[idx];
        if (i.title || i.body || i.image_url || i.link_url) {
          payload.push({ user_id: uid, section: 1, title: i.title, body: i.body, image_url: i.image_url, link_url: i.link_url, sort_order: idx });
        }
      }
      if (payload.length) { var res = await supabase.from("app_user_sections").insert(payload); if (res.error) { showToast(res.error.message, "error"); return; } }
      showToast("تم حفظ المحتوى الخاص ✓");
    } finally { setSaving(false); }
  }

  function groupBySection(items) {
    var acc = {};
    for (var idx = 0; idx < items.length; idx++) {
      var s = items[idx].section;
      if (!acc[s]) acc[s] = [];
      acc[s].push(items[idx]);
    }
    return acc;
  }

  /* ===== LOGIN PAGE ===== */
  if (!session) {
    return (
      <div className="auth-page">
        <ToastContainer />
        <div className="auth-card">
          <div className="auth-logo">🕌</div>
          <div className="auth-title">بوابة العميل</div>
          <div className="auth-subtitle">سجّل دخولك لإدارة المحتوى والمشاركة</div>
          {authMsg && <div className={"alert " + authMsg.type}>{authMsg.text}</div>}
          <div className="auth-form">
            <div className="field">
              <label>البريد الإلكتروني</label>
              <input type="email" placeholder="name@example.com" value={email} onChange={function(e){setEmail(e.target.value);}} />
            </div>
            <div className="field">
              <label>كلمة المرور</label>
              <div className="pass-wrap">
                <input type={showPass?"text":"password"} value={password} onChange={function(e){setPassword(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")signIn();}} />
                <button type="button" className="pass-toggle" onClick={function(){setShowPass(!showPass);}}>{showPass?"إخفاء":"عرض"}</button>
              </div>
            </div>
          </div>
          <div className="auth-actions">
            <button className="btn-primary" onClick={signIn} disabled={authBusy}>{authBusy?"جاري الدخول...":"تسجيل الدخول"}</button>
            <button className="btn-secondary" style={{width:"100%",padding:12,borderRadius:12,fontSize:14}} onClick={signUp} disabled={authBusy}>إنشاء حساب جديد</button>
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
        <h1><span>🕌</span> بوابة {client ? client.name : "العميل"}</h1>
        <button className="btn-logout" onClick={signOut}>تسجيل الخروج ←</button>
      </div>
      <div className="container">

        {client && (
          <div className="card" style={{display:"flex",alignItems:"center",gap:16}}>
            {client.logo_url && <img src={client.logo_url} alt="logo" style={{width:48,height:48,borderRadius:12,objectFit:"contain"}} onError={function(e){e.target.style.display="none";}} />}
            <div>
              <div style={{fontWeight:700,fontSize:18}}>مرحباً 👋</div>
              <div className="muted">أنت تدير محتوى: {client.name} ({client.slug})</div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title"><span className="icon">📝</span> محتوى المستخدم الخاص</div>
          <ListEditor items={userItems} setter={setUserItems} showBody={true} showImage={true} onUpload={uploadUserImage} uploading={uploading} />
          <div className="actions">
            <button className="btn-add" onClick={function(){setUserItems(userItems.concat([emptyItem()]));}}>+ إضافة عنصر</button>
            <button className="btn-save" onClick={function(){saveUserSection(userItems);}} disabled={saving}>{saving?"جاري الحفظ...":"💾 حفظ المحتوى"}</button>
          </div>
        </div>

        {client && (
          <div>
            <div className="card">
              <div className="card-title"><span className="icon">🏢</span> بيانات الشركة</div>
              <ContentEditor item={section1} onChange={setSection1} onUpload={uploadImage} uploading={uploading} />
              <div className="actions"><button className="btn-save" onClick={function(){saveSection(1,[section1]);}} disabled={saving}>{saving?"جاري الحفظ...":"💾 حفظ"}</button></div>
            </div>

            <div className="card">
              <div className="card-title"><span className="icon">🔗</span> روابط الشركة</div>
              <ListEditor items={links} setter={setLinks} showBody={true} showImage={true} onUpload={uploadImage} uploading={uploading} />
              <div className="actions">
                <button className="btn-add" onClick={function(){setLinks(links.concat([emptyItem()]));}}>+ إضافة رابط</button>
                <button className="btn-save" onClick={function(){saveSection(2,links);}} disabled={saving}>{saving?"جاري الحفظ...":"💾 حفظ الروابط"}</button>
              </div>
            </div>

            <div className="card">
              <div className="card-title"><span className="icon">🎁</span> عروض الشركة</div>
              <ListEditor items={offers} setter={setOffers} showBody={true} showImage={true} onUpload={uploadImage} uploading={uploading} />
              <div className="actions">
                <button className="btn-add" onClick={function(){setOffers(offers.concat([emptyItem()]));}}>+ إضافة عرض</button>
                <button className="btn-save" onClick={function(){saveSection(3,offers);}} disabled={saving}>{saving?"جاري الحفظ...":"💾 حفظ العروض"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

/* ========== Content Editor ========== */
function ContentEditor(props) {
  var item = props.item;
  var onChange = props.onChange;
  var onUpload = props.onUpload;
  var uploading = props.uploading;
  return (
    <div>
      <div className="row">
        <div style={{flex:1}}><label>العنوان</label><input value={item.title||""} onChange={function(e){onChange(Object.assign({},item,{title:e.target.value}));}} /></div>
        <div style={{flex:1}}><label>رابط</label><input value={item.link_url||""} onChange={function(e){onChange(Object.assign({},item,{link_url:e.target.value}));}} placeholder="https://..." /></div>
      </div>
      <div style={{marginTop:8}}>
        <label>صورة</label>
        <div className="row">
          <div style={{flex:1}}><input value={item.image_url||""} onChange={function(e){onChange(Object.assign({},item,{image_url:e.target.value}));}} placeholder="رابط الصورة أو ارفع ملف..." /></div>
          {onUpload && (
            <div>
              <label className="btn-secondary" style={{display:"inline-block",padding:"10px 16px",borderRadius:8,cursor:"pointer",whiteSpace:"nowrap",fontSize:13}}>
                {uploading ? "جاري الرفع..." : "📷 رفع صورة"}
                <input type="file" accept="image/*" style={{display:"none"}} disabled={uploading} onChange={async function(e) {
                  var file = e.target.files && e.target.files[0]; if (!file) return;
                  var url = await onUpload(file);
                  if (url) onChange(Object.assign({}, item, { image_url: url }));
                  e.target.value = "";
                }} />
              </label>
            </div>
          )}
        </div>
        {item.image_url && <div className="img-preview"><img src={item.image_url} alt="" onError={function(e){e.target.parentNode.style.display="none";}} /></div>}
      </div>
      <div style={{marginTop:8}}><label>النص / الوصف</label><textarea value={item.body||""} onChange={function(e){onChange(Object.assign({},item,{body:e.target.value}));}} /></div>
    </div>
  );
}

/* ========== List Editor ========== */
function ListEditor(props) {
  var items = props.items;
  var setter = props.setter;
  var showBody = props.showBody !== false;
  var showImage = props.showImage !== false;
  var onUpload = props.onUpload;
  var uploading = props.uploading;
  function handleUpdate(index, field, value) {
    var updated = items.slice();
    updated[index] = Object.assign({}, updated[index]);
    updated[index][field] = value;
    setter(updated);
  }
  function handleRemove(index) {
    var updated = items.filter(function(_,i){return i!==index;});
    setter(updated.length ? updated : [emptyItem()]);
  }
  return (
    <div>
      {items.map(function(item, index) {
        return (
          <div className="list-item" key={item._key || index}>
            <div className="item-header">
              <span className="item-number">#{index + 1}</span>
              <button className="btn-danger" onClick={function(){handleRemove(index);}}>🗑 حذف</button>
            </div>
            <div className="row">
              <div style={{flex:1}}><label>العنوان</label><input value={item.title||""} onChange={function(e){handleUpdate(index,"title",e.target.value);}} /></div>
              <div style={{flex:1}}><label>رابط</label><input value={item.link_url||""} onChange={function(e){handleUpdate(index,"link_url",e.target.value);}} placeholder="https://..." /></div>
            </div>
            {showImage && (
              <div style={{marginTop:8}}>
                <label>صورة</label>
                <div className="row">
                  <div style={{flex:1}}><input value={item.image_url||""} onChange={function(e){handleUpdate(index,"image_url",e.target.value);}} placeholder="رابط الصورة أو ارفع ملف..." /></div>
                  {onUpload && (
                    <div>
                      <label className="btn-secondary" style={{display:"inline-block",padding:"10px 16px",borderRadius:8,cursor:"pointer",whiteSpace:"nowrap",fontSize:13}}>
                        {uploading ? "..." : "📷 رفع"}
                        <input type="file" accept="image/*" style={{display:"none"}} disabled={uploading} onChange={async function(e) {
                          var file = e.target.files && e.target.files[0]; if (!file) return;
                          var url = await onUpload(file);
                          if (url) handleUpdate(index, "image_url", url);
                          e.target.value = "";
                        }} />
                      </label>
                    </div>
                  )}
                </div>
                {item.image_url && <div className="img-preview"><img src={item.image_url} alt="" onError={function(e){e.target.parentNode.style.display="none";}} /></div>}
              </div>
            )}
            {showBody && (
              <div style={{marginTop:8}}><label>الوصف</label><textarea value={item.body||""} onChange={function(e){handleUpdate(index,"body",e.target.value);}} /></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
