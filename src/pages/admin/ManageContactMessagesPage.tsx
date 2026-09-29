import React, { useState, useEffect } from 'react';
import {
  Mail,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  User,
  ShieldCheck,
  Calendar,
  Send,
} from 'lucide-react';
import { authFetch } from '../../services/api';
import { SOCIAL_CONFIG } from '../../config/socialConfig';

interface ContactMessageRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  recipient: string;
  submittedAt: string;
  status: 'delivered' | 'failed' | 'stored';
  messageId?: string;
  deliveryError?: string;
  previewUrl?: string;
  senderRole?: 'student' | 'admin' | 'public';
  studentId?: string;
}

export const ManageContactMessagesPage: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageRecord | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/contact/messages');
      if (!res.ok) {
        throw new Error('Failed to fetch contact inquiries');
      }
      const data = await res.json();
      setMessages(data);
      if (data.length > 0 && !selectedMessage) {
        setSelectedMessage(data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const filteredMessages = messages.filter(
    msg =>
      msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5DFD5] p-5 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F5132] uppercase tracking-wider mb-1">
            <Mail className="w-4 h-4" />
            <span>Direct Inquiries Log</span>
          </div>
          <h2 className="text-xl font-serif-academic font-bold text-[#1C2826]">
            Student & Institutional Correspondence
          </h2>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Messages routed directly to <strong className="font-mono-code text-[#1C2826]">{SOCIAL_CONFIG.recipientEmail}</strong> via server email dispatch.
          </p>
        </div>

        <button
          onClick={fetchMessages}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#1C2826] bg-[#FAF8F5] border border-[#E5DFD5] rounded-md hover:bg-[#F5F1EB] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0F5132]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Messages List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C9E96]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search sender, email, subject..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#E5DFD5] rounded-lg text-xs text-[#1C2826] placeholder-[#8C9E96] focus:outline-none focus:border-[#0F5132]"
            />
          </div>

          <div className="bg-white border border-[#E5DFD5] rounded-xl overflow-hidden shadow-xs divide-y divide-[#E5DFD5] max-h-[600px] overflow-y-auto">
            {loading && messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5C6F68]">
                <div className="w-6 h-6 border-2 border-[#0F5132] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading messages...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5C6F68]">
                No messages found matching your search.
              </div>
            ) : (
              filteredMessages.map(msg => {
                const isSelected = selectedMessage?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full text-left p-4 transition-colors hover:bg-[#FAF8F5] cursor-pointer flex flex-col gap-1.5 ${
                      isSelected ? 'bg-[#E8F5E9]/50 border-l-4 border-l-[#0F5132]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1C2826] truncate max-w-[180px]">
                        {msg.name}
                      </span>
                      <span className="text-[10px] text-[#5C6F68] shrink-0 font-mono-code">
                        {new Date(msg.submittedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-[#0F5132] truncate">
                      {msg.subject}
                    </div>

                    <p className="text-[11px] text-[#5C6F68] line-clamp-2">
                      {msg.message}
                    </p>

                    <div className="flex items-center gap-2 pt-1 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono-code font-medium ${
                          msg.senderRole === 'student'
                            ? 'bg-[#E8F5E9] text-[#0F5132]'
                            : msg.senderRole === 'admin'
                            ? 'bg-[#EDE8E0] text-[#1C2826]'
                            : 'bg-[#F5F1EB] text-[#5C6F68]'
                        }`}
                      >
                        {msg.senderRole?.toUpperCase() || 'PUBLIC'}
                      </span>
                      <span className="text-[#8C9E96]">·</span>
                      <span className="text-[#10B981] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Delivered</span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Message Detail (7 cols) */}
        <div className="lg:col-span-7">
          {selectedMessage ? (
            <div className="bg-white border border-[#E5DFD5] rounded-xl p-6 sm:p-7 shadow-xs space-y-6">
              {/* Message Header */}
              <div className="border-b border-[#E5DFD5] pb-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-lg font-serif-academic font-bold text-[#1C2826]">
                    {selectedMessage.subject}
                  </h3>
                  <a
                    href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(
                      'Re: ' + selectedMessage.subject
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F5132] text-white text-xs font-semibold rounded-md hover:bg-[#064E3B] transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Reply via Email</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#5C6F68] mt-3">
                  <div>
                    <span className="font-medium text-[#1C2826]">From: </span>
                    <span>{selectedMessage.name}</span> (
                    <a
                      href={`mailto:${selectedMessage.email}`}
                      className="text-[#0F5132] hover:underline font-mono-code text-[11px]"
                    >
                      {selectedMessage.email}
                    </a>
                    )
                  </div>
                  <div>
                    <span className="font-medium text-[#1C2826]">Recipient: </span>
                    <span className="font-mono-code text-[11px] text-[#0F5132]">
                      {selectedMessage.recipient}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-[#1C2826]">Role: </span>
                    <span className="capitalize">{selectedMessage.senderRole || 'Public'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-[#1C2826]">Submitted: </span>
                    <span>{new Date(selectedMessage.submittedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <h4 className="text-xs font-mono-code font-semibold uppercase tracking-wider text-[#5C6F68] mb-2">
                  Message Content
                </h4>
                <div className="p-4 bg-[#FAF8F5] border border-[#E5DFD5] rounded-lg text-xs text-[#1C2826] leading-relaxed whitespace-pre-wrap font-sans-body">
                  {selectedMessage.message}
                </div>
              </div>

              {/* Delivery Meta */}
              <div className="p-4 bg-[#F5F1EB] rounded-lg border border-[#E5DFD5] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1C2826] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0F5132]" />
                    <span>Delivery Verification Status</span>
                  </span>
                  <span className="text-[#10B981] font-semibold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Dispatched to {selectedMessage.recipient}</span>
                  </span>
                </div>
                {selectedMessage.messageId && (
                  <div className="text-[11px] text-[#5C6F68] font-mono-code">
                    Message ID: {selectedMessage.messageId}
                  </div>
                )}
                {selectedMessage.previewUrl && (
                  <div className="pt-1">
                    <a
                      href={selectedMessage.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F5132] hover:underline"
                    >
                      <span>View Live Ethereal Mail Delivery Stream</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5DFD5] rounded-xl p-12 text-center text-xs text-[#5C6F68]">
              Select a message from the list to view its contents.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
