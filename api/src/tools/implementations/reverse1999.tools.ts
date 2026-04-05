import { SchemaType } from '@google/generative-ai';
import { AgentTool } from '../interfaces/tool.interface';
import * as path from 'path';
import * as fs from 'fs';

const dataDir = path.join(__dirname, '..', 'data');

function loadJSON(filename: string): any {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export const reverse1999Tools: AgentTool[] = [
  {
    id: 'get_character_info',
    niches: ['generic'],
    icon: '🎭',
    displayName: 'Character Info',
    declaration: {
      name: 'getCharacterInfo',
      description:
        'Obtiene las estadísticas exactas, habilidades (skills), pasivas (insights) y psychubes recomendados de un personaje específico de Reverse: 1999.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          characterName: {
            type: SchemaType.STRING,
            description: "El nombre del personaje en inglés (ej. 'Tooth Fairy', 'Jiu Niangzi', '37').",
          },
        },
        required: ['characterName'],
      },
    },
    execute: async (args) => {
      const characters = loadJSON('db_characters.json');
      const name = (args.characterName || '').toLowerCase();
      const character = characters.find(
        (c: any) => (c.name || '').toLowerCase() === name,
      );
      if (!character) {
        return { result: `Character "${args.characterName}" was not found in the database. This character may not exist or the name may be spelled differently.` };
      }
      return character;
    },
  },
  {
    id: 'find_teams_for_character',
    niches: ['generic'],
    icon: '⚔️',
    displayName: 'Meta Teams',
    declaration: {
      name: 'findTeamsForCharacter',
      description:
        'Busca en la base de datos de meta teams y devuelve los equipos en los que encaja un personaje específico, ya sea como núcleo (core) o como alternativa (flex).',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          characterName: {
            type: SchemaType.STRING,
            description: 'El nombre del personaje en inglés.',
          },
        },
        required: ['characterName'],
      },
    },
    execute: async (args) => {
      const teams = loadJSON('db_teams.json');
      const name = (args.characterName || '').toLowerCase();
      const matched = teams.filter((team: any) => {
        const members = [
          ...(team.core || []),
          ...(team.flex || []),
          ...(team.members || []),
        ];
        return members.some((m: any) => {
          const memberName = typeof m === 'string' ? m : m.name || '';
          return memberName.toLowerCase() === name;
        });
      });
      if (matched.length === 0) {
        return { result: `No meta teams found for "${args.characterName}". This character may not be part of any current meta team compositions.` };
      }
      return { teams: matched };
    },
  },
  {
    id: 'get_psychube_details',
    niches: ['generic'],
    icon: '🔮',
    displayName: 'Psychube Details',
    declaration: {
      name: 'getPsychubeDetails',
      description:
        'Obtiene la descripción exacta y los efectos de amplificación (niveles 1 y 5) de un Psychube (artefacto/arma) del juego.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          psychubeName: {
            type: SchemaType.STRING,
            description: "El nombre exacto del Psychube (ej. 'Blasphemer of Night', 'That Inquisitive Dear').",
          },
        },
        required: ['psychubeName'],
      },
    },
    execute: async (args) => {
      const psychubes = loadJSON('db_psychubes.json');
      const name = (args.psychubeName || '');
      const psychube = psychubes[name]
        || Object.entries(psychubes).find(
          ([key]) => key.toLowerCase() === name.toLowerCase(),
        )?.[1];
      if (!psychube) {
        return { result: `Psychube "${args.psychubeName}" was not found in the database. The name may be spelled differently.` };
      }
      return { name, ...psychube };
    },
  },
];
