import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  MessageCircle,
  Send,
  RefreshCw,
  Check,
  CheckCheck,
} from 'lucide-react';
import { Conversation, ChatMessage } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function MessagesPage({
  initialConversationId,
  onProduct,
}: {
  initialConversationId: string | null;
  onProduct: (id: string) => void;
}) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(
    initialConversationId,
  );
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const activeId = useRef(selected);
  activeId.current = selected;
  const requestId = useRef<{
    body: string;
    id: string;
    conversationId: string;
  } | null>(null);
  useEffect(() => {
    if (initialConversationId) setSelected(initialConversationId);
  }, [initialConversationId]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api.messages.list();
        if (active) {
          setConversations(data);
          setListError('');
        }
      } catch (e) {
        if (active)
          setListError(
            e instanceof Error ? e.message : 'Suhbatlarni yuklab bo‘lmadi',
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, retry]);
  const merge = (old: ChatMessage[], fresh: ChatMessage[]) =>
    [...new Map([...old, ...fresh].map((m) => [m.id, m])).values()].sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setMessages([]);
    setConversation(null);
    setDraft(
      sessionStorage.getItem(`agro_chat_draft_${user?.id}_${selected}`) || '',
    );
    setError('');
    setCursor(null);
    setChatLoading(true);
    const load = async (initial = false) => {
      try {
        const data = await api.messages.history(selected);
        if (!active) return;
        const follow = log.current
          ? log.current.scrollHeight -
              log.current.scrollTop -
              log.current.clientHeight <
            100
          : false;
        setMessages((old) => merge(old, data.messages));
        if (!initial && follow)
          setTimeout(() => {
            if (active) bottom.current?.scrollIntoView({ block: 'end' });
          }, 50);
        setConversation(data.conversation);
        setError('');
        if (initial) {
          setCursor(data.next_cursor);
          setTimeout(
            () => bottom.current?.scrollIntoView({ block: 'end' }),
            50,
          );
        }
        setConversations((old) =>
          old.map((c) =>
            c.id === selected ? { ...c, _count: { messages: 0 } } : c,
          ),
        );
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Xabarlarni yuklab bo‘lmadi',
          );
      } finally {
        if (active) setChatLoading(false);
      }
    };
    void load(true);
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, retry]);
  const older = async () => {
    if (!selected || !cursor) return;
    const id = selected;
    setOlderLoading(true);
    try {
      const data = await api.messages.history(id, cursor);
      if (activeId.current === id) {
        setMessages((old) => merge(old, data.messages));
        setCursor(data.next_cursor);
      }
    } catch (e) {
      if (activeId.current === id)
        setError(e instanceof Error ? e.message : 'Yuklashda xatolik');
    } finally {
      setOlderLoading(false);
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!selected || !body || sending) return;
    const id = selected;
    if (
      !requestId.current ||
      requestId.current.body !== body ||
      requestId.current.conversationId !== id
    )
      requestId.current = { body, id: crypto.randomUUID(), conversationId: id };
    setSending(true);
    setError('');
    try {
      const sent = await api.messages.send(id, body, requestId.current.id);
      requestId.current = null;
      if (activeId.current === id) {
        setMessages((old) => merge(old, [sent]));
        setDraft('');
        sessionStorage.removeItem(`agro_chat_draft_${user?.id}_${id}`);
        setTimeout(
          () =>
            bottom.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'end',
            }),
          50,
        );
      }
      setConversations((old) =>
        old
          .map((c) =>
            c.id === id
              ? { ...c, messages: [sent], updated_at: sent.created_at }
              : c,
          )
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      );
    } catch (e) {
      if (activeId.current === id)
        setError(
          e instanceof Error
            ? e.message
            : 'Xabar yuborilmadi. Qayta urinib ko‘ring.',
        );
    } finally {
      setSending(false);
    }
  };
  const partner = conversation
    ? conversation.buyer_id === user?.id
      ? conversation.seller
      : conversation.buyer
    : null;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
            Bevosita muloqot
          </p>
          <h1 className="text-3xl font-black text-agro-dark mt-1">Xabarlar</h1>
        </div>
        <button
          onClick={() => setRetry((n) => n + 1)}
          title="Xabarlarni yangilash"
          className="p-3 rounded-xl bg-white border"
        >
          <RefreshCw size={19} />
        </button>
      </div>
      <div className="grid md:grid-cols-[280px_minmax(0,1fr)] rounded-3xl border border-gray-200 bg-white overflow-hidden min-h-[60dvh]">
        <aside
          aria-label="Suhbatlar"
          className={`border-r min-w-0 ${selected ? 'hidden md:block' : ''}`}
        >
          {listError && (
            <p role="alert" className="text-rose-700 text-sm p-4">
              {listError}
            </p>
          )}
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Suhbatlar yuklanmoqda…</p>
          ) : !conversations.length ? (
            <div className="p-7 text-sm text-gray-500">
              <MessageCircle className="mb-3 text-emerald-700" />
              <p>
                Hozircha suhbatlar yo‘q. Bozorda mahsulotni ochib, “Sotuvchiga
                yozish”ni bosing.
              </p>
            </div>
          ) : (
            conversations.map((c) => {
              const other = c.buyer_id === user?.id ? c.seller : c.buyer;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`w-full p-4 border-b text-left flex gap-3 items-center ${selected === c.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                >
                  <img
                    src={c.product.image_url}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover bg-gray-100 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">
                      {other.full_name}
                    </p>
                    <p className="text-xs text-emerald-700 truncate">
                      {c.product.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {c.messages?.[0]?.body || 'Yangi suhbat'}
                    </p>
                  </div>
                  {!!c._count?.messages && (
                    <span className="text-xs bg-emerald-700 text-white rounded-full px-2 py-1">
                      {c._count.messages}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </aside>
        <section
          aria-label="Yozishmalar"
          className={`min-w-0 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}
        >
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-sm">
              <MessageCircle size={40} className="mb-4" />
              Suhbatni tanlang
            </div>
          ) : (
            <>
              <div className="p-4 flex items-center gap-3 border-b">
                <button
                  aria-label="Suhbatlar ro‘yxatiga qaytish"
                  onClick={() => setSelected(null)}
                  className="md:hidden p-2 rounded-xl bg-gray-50"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="font-bold truncate">
                    {partner?.full_name || 'Suhbat'}
                  </h2>
                  {conversation && (
                    <button
                      className="text-xs text-emerald-800 truncate max-w-full text-left underline"
                      onClick={() => onProduct(conversation.product.id)}
                    >
                      {conversation.product.title} · Mahsulotni ko‘rish
                    </button>
                  )}
                </div>
              </div>
              <div
                ref={log}
                role="log"
                aria-label="Suhbat xabarlari"
                aria-live="polite"
                className="h-[45dvh] min-h-56 overflow-y-auto p-4 space-y-3 bg-[#f5f7f3]"
              >
                {cursor && (
                  <button
                    disabled={olderLoading}
                    onClick={older}
                    className="block mx-auto text-xs text-emerald-800 py-2"
                  >
                    {olderLoading ? 'Yuklanmoqda…' : 'Oldingi xabarlar'}
                  </button>
                )}
                {chatLoading ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    Xabarlar yuklanmoqda…
                  </p>
                ) : !messages.length ? (
                  <p className="text-center text-sm text-gray-500 py-8">
                    Salom ayting! Narx, miqdor va yetkazishni shu yerda
                    kelishing.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 ${m.sender_id === user?.id ? 'bg-agro-green text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'}`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {m.body}
                        </p>
                        <p className="text-[10px] opacity-60 mt-2 flex justify-end items-center gap-1">
                          {new Date(m.created_at).toLocaleString('uz-UZ', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Tashkent',
                          })}
                          {m.sender_id === user?.id &&
                            (m.read_at ? (
                              <CheckCheck size={13} aria-label="O‘qilgan" />
                            ) : (
                              <Check size={13} aria-label="Yuborilgan" />
                            ))}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottom} />
              </div>
              {error && (
                <p
                  role="alert"
                  className="p-3 bg-rose-50 text-rose-700 text-xs"
                >
                  {error}
                </p>
              )}
              <form
                onSubmit={send}
                className="flex gap-2 p-3 border-t bg-white"
              >
                <textarea
                  aria-label="Xabaringiz"
                  placeholder="Xabaringizni yozing…"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    sessionStorage.setItem(
                      `agro_chat_draft_${user?.id}_${selected}`,
                      e.target.value,
                    );
                  }}
                  maxLength={2000}
                  rows={2}
                  disabled={chatLoading || sending}
                  className="min-w-0 flex-1 resize-none text-base rounded-xl bg-gray-50 border p-3 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
                <button
                  aria-label="Xabar yuborish"
                  disabled={
                    sending || chatLoading || !conversation || !draft.trim()
                  }
                  className="self-end bg-agro-green text-white p-3 rounded-xl disabled:opacity-40"
                >
                  <Send size={20} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
