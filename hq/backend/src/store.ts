import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { SquadState } from './types';

const STORE_FILE = path.join(__dirname, '../../active_squad.json');
const TEMPLATES_FILE = path.join(__dirname, '../../templates.json');
const KNOWLEDGE_FILE = path.join(__dirname, '../../company_knowledge.json');

export interface Template {
  name: string;
  activeAgentIds: string[];
}

export interface KnowledgeEntry {
  task: string;
  agentId: string;
  resultSummary: string;
  timestamp?: number;
}

export class Store extends EventEmitter {
  private state: SquadState = { activeAgentIds: [] };

  constructor() {
    super();
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        this.state = JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load active squad:', err);
    }
  }

  public save(activeAgentIds: string[]) {
    this.state = { activeAgentIds };
    fs.writeFileSync(STORE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    this.emit('changed', this.state);
  }

  public getActiveIds(): string[] {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.activeAgentIds || [];
      }
    } catch (err) {
      // fallback
    }
    return this.state.activeAgentIds;
  }

  // --- Templates Logic ---

  public getTemplates(): Template[] {
    try {
      if (fs.existsSync(TEMPLATES_FILE)) {
        return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
      }
    } catch (err) {}
    return [];
  }

  public saveTemplate(name: string, activeAgentIds: string[]) {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.name === name);
    if (index >= 0) {
      templates[index].activeAgentIds = activeAgentIds;
    } else {
      templates.push({ name, activeAgentIds });
    }
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
  }

  public deleteTemplate(name: string) {
    const templates = this.getTemplates().filter(t => t.name !== name);
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
  }

  // --- Knowledge Base Logic ---

  public getKnowledge(): KnowledgeEntry[] {
    try {
      if (fs.existsSync(KNOWLEDGE_FILE)) {
        return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load knowledge:', err);
    }
    return [];
  }

  public saveKnowledge(entry: KnowledgeEntry) {
    const knowledge = this.getKnowledge();
    knowledge.push({ ...entry, timestamp: Date.now() });

    // 保留最近 100 条记录，防止无限增长
    const MAX_KNOWLEDGE_ENTRIES = 100;
    if (knowledge.length > MAX_KNOWLEDGE_ENTRIES) {
      knowledge.splice(0, knowledge.length - MAX_KNOWLEDGE_ENTRIES);
    }

    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2), 'utf-8');
  }

  /**
   * 特征提取：支持中文字符和英文单词
   */
  private getFeatures(text: string): Map<string, number> {
    const features = new Map<string, number>();
    const words = text.toLowerCase().split(/[\s,，.。!！?？\-_/]+/).filter(t => t.length > 0);
    words.forEach(w => features.set(w, (features.get(w) || 0) + 1));

    // 中文按字符提取
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (/[\u4e00-\u9fa5]/.test(char)) {
        features.set(char, (features.get(char) || 0) + 1);
      }
    }
    return features;
  }

  /**
   * 计算知识条目与查询的相关性得分
   * 使用与专家匹配相同的语义匹配算法
   */
  private calculateKnowledgeScore(entry: KnowledgeEntry, query: string): number {
    const queryFeatures = this.getFeatures(query);
    const taskFeatures = this.getFeatures(entry.task);
    const resultFeatures = this.getFeatures(entry.resultSummary);
    const agentFeatures = this.getFeatures(entry.agentId);

    let score = 0;
    queryFeatures.forEach((count, feature) => {
      // 任务描述权重最高
      if (taskFeatures.has(feature)) score += count * taskFeatures.get(feature)! * 5;
      // 结果摘要次之
      if (resultFeatures.has(feature)) score += count * resultFeatures.get(feature)! * 3;
      // 专家 ID 也有参考价值
      if (agentFeatures.has(feature)) score += count * agentFeatures.get(feature)! * 2;
    });

    return score;
  }

  /**
   * 语义搜索知识库
   * 返回最相关的 3 条记录
   */
  public searchKnowledge(query: string, limit: number = 3): KnowledgeEntry[] {
    const knowledge = this.getKnowledge();
    if (!query) return [];

    // 计算每条记录的相关性得分
    const scored = knowledge
      .map(entry => ({
        entry,
        score: this.calculateKnowledgeScore(entry, query)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // 返回得分最高的 N 条
    return scored.slice(0, limit).map(item => item.entry);
  }
}
