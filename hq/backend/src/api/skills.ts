import type express from 'express';
import type { SkillScanner } from '../skill-scanner';

export interface SkillRouteDependencies {
  skillScanner: SkillScanner;
}

export function registerSkillRoutes(app: express.Application, dependencies: SkillRouteDependencies) {
  app.get('/api/skills', async (_req, res) => {
    const skills = await dependencies.skillScanner.scan();
    const hostCounts = skills
      .flatMap((skill) => skill.installations)
      .reduce<Record<string, number>>((acc, installation) => {
        acc[installation.host] = (acc[installation.host] || 0) + 1;
        return acc;
      }, {});

    return res.json({
      summary: {
        totalSkills: skills.length,
        hostCounts,
      },
      skills,
    });
  });
}
