/**
 * Skills Loader
 * 
 * Loads all marketing and creative skill frameworks from SKILL.md files
 * and makes them available to the orchestrator agent.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Skill {
  name: string;
  description: string;
  content: string;
  references?: string[];
}

/**
 * Parse the YAML frontmatter from a SKILL.md file
 */
function parseFrontmatter(content: string): { name: string; description: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { name: 'unknown', description: '', body: content };
  }

  const frontmatter = match[1];
  const body = match[2];

  // Simple YAML parsing for name and description
  const nameMatch = frontmatter.match(/name:\s*(.+)/);
  const descMatch = frontmatter.match(/description:\s*"?([^"]+)"?/);

  return {
    name: nameMatch?.[1]?.trim() || 'unknown',
    description: descMatch?.[1]?.trim() || '',
    body: body.trim(),
  };
}

/**
 * Load all skills from the skills directory
 */
export function loadAllSkills(): Skill[] {
  const skills: Skill[] = [];
  const skillsDir = __dirname;

  try {
    const directories = readdirSync(skillsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const dir of directories) {
      const skillPath = join(skillsDir, dir, 'SKILL.md');
      
      if (existsSync(skillPath)) {
        try {
          const content = readFileSync(skillPath, 'utf-8');
          const { name, description, body } = parseFrontmatter(content);

          // Load any reference files
          const references: string[] = [];
          const refsDir = join(skillsDir, dir, 'references');
          
          if (existsSync(refsDir)) {
            const refFiles = readdirSync(refsDir).filter(f => f.endsWith('.md'));
            for (const refFile of refFiles) {
              const refContent = readFileSync(join(refsDir, refFile), 'utf-8');
              references.push(`### Reference: ${refFile}\n${refContent}`);
            }
          }

          skills.push({
            name: name || dir,
            description,
            content: body,
            references: references.length > 0 ? references : undefined,
          });
        } catch (error) {
          console.warn(`Warning: Could not load skill from ${skillPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not read skills directory:', error);
  }

  return skills;
}

/**
 * Get a specific skill by name
 */
export function getSkill(name: string): Skill | undefined {
  const skills = loadAllSkills();
  return skills.find(s => s.name === name);
}

/**
 * Generate the skills registry for the system prompt
 */
export function getSkillsRegistry(): string {
  const skills = loadAllSkills();
  
  if (skills.length === 0) {
    return '';
  }

  let registry = `\n## Marketing & Creative Skills Registry\n\n`;
  registry += `You have access to ${skills.length} specialized marketing and creative skills:\n\n`;
  
  // Group by type
  const ppcSkills = ['keyword-research', 'direct-response-copy', 'seo-content'];
  const brandSkills = ['brand-voice', 'positioning-angles'];
  const contentSkills = ['content-atomizer', 'newsletter', 'email-sequences', 'lead-magnet'];
  const creativeSkills = ['ai-creative-strategist', 'ai-image-generation', 'ai-product-photo', 'ai-product-video', 'ai-social-graphics', 'ai-talking-head'];

  registry += `### PPC & SEO Skills\n`;
  registry += `| Skill | What It Does |\n`;
  registry += `|-------|-------------|\n`;
  for (const skill of skills.filter(s => ppcSkills.includes(s.name))) {
    registry += `| **${skill.name}** | ${skill.description.slice(0, 100)}... |\n`;
  }

  registry += `\n### Brand & Strategy Skills\n`;
  registry += `| Skill | What It Does |\n`;
  registry += `|-------|-------------|\n`;
  for (const skill of skills.filter(s => brandSkills.includes(s.name))) {
    registry += `| **${skill.name}** | ${skill.description.slice(0, 100)}... |\n`;
  }

  registry += `\n### Content & Email Skills\n`;
  registry += `| Skill | What It Does |\n`;
  registry += `|-------|-------------|\n`;
  for (const skill of skills.filter(s => contentSkills.includes(s.name))) {
    registry += `| **${skill.name}** | ${skill.description.slice(0, 100)}... |\n`;
  }

  registry += `\n### Creative & Visual Skills\n`;
  registry += `| Skill | What It Does |\n`;
  registry += `|-------|-------------|\n`;
  for (const skill of skills.filter(s => creativeSkills.includes(s.name))) {
    registry += `| **${skill.name}** | ${skill.description.slice(0, 100)}... |\n`;
  }

  // Add orchestrator skill
  const orchestrator = skills.find(s => s.name === 'orchestrator');
  if (orchestrator) {
    registry += `\n### Marketing Orchestration\n`;
    registry += `| **orchestrator** | Routes complex marketing requests to the right skill sequence |\n`;
  }

  return registry;
}

/**
 * Get the full content of all skills for deep knowledge
 */
export function getSkillsKnowledge(): string {
  const skills = loadAllSkills();
  
  let knowledge = `\n# MARKETING & CREATIVE SKILLS KNOWLEDGE BASE\n\n`;
  knowledge += `The following are detailed frameworks for marketing and creative tasks.\n`;
  knowledge += `Use these as reference when users ask about marketing, content, or creative strategy.\n\n`;
  knowledge += `---\n\n`;

  for (const skill of skills) {
    knowledge += `# SKILL: ${skill.name.toUpperCase()}\n\n`;
    knowledge += `**Description:** ${skill.description}\n\n`;
    knowledge += skill.content;
    knowledge += `\n\n---\n\n`;
  }

  return knowledge;
}

/**
 * Get a condensed version for use in system prompts (summary only)
 */
export function getSkillsSummary(): string {
  const skills = loadAllSkills();
  
  let summary = `\n## Available Marketing Skills\n\n`;
  summary += `When users ask about marketing, content, or creative tasks, you have these specialized frameworks:\n\n`;

  for (const skill of skills) {
    summary += `- **${skill.name}**: ${skill.description}\n`;
  }

  summary += `\nFor complex marketing requests, use the "orchestrator" skill logic to route to the right sequence.\n`;
  
  return summary;
}

// Export loaded skills count for logging
export const skillCount = loadAllSkills().length;
