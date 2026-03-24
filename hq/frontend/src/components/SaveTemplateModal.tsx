/**
 * 保存团队模板弹窗组件
 */
import { motion, AnimatePresence } from 'framer-motion';

export interface SaveTemplateModalProps {
  show: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SaveTemplateModal({ show, value, onChange, onSave, onCancel }: SaveTemplateModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mb-6 overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-3xl">
            <input
              autoFocus
              type="text"
              placeholder="输入公司模板名称..."
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-lg text-white outline-none focus:ring-2 ring-cyan-500/50 mb-4"
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
            <div className="flex justify-end gap-4">
              <button
                onClick={onCancel}
                className="text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest"
              >
                取消
              </button>
              <button
                onClick={onSave}
                className="text-xs font-black text-cyan-400 uppercase tracking-widest px-4 py-2 bg-cyan-500/10 rounded-lg"
              >
                保存团队
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
