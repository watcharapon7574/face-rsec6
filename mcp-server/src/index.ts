#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = new Server(
  {
    name: 'face-attendance-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools: Tool[] = [
  {
    name: 'init_schema',
    description: 'Initialize database schema by running the SQL schema file. Creates all tables: attendance_settings, locations, teachers, attendance_records with seed data.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_locations',
    description: 'List all service locations (หน่วยบริการ) with their GPS coordinates and radius.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_location',
    description: 'Update GPS coordinates and radius for a specific location.',
    inputSchema: {
      type: 'object',
      properties: {
        location_id: { type: 'string', description: 'Location UUID' },
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
        radius_meters: { type: 'number', description: 'Radius in meters' },
      },
      required: ['location_id'],
    },
  },
  {
    name: 'list_teachers',
    description: 'List all teachers with their assigned locations.',
    inputSchema: {
      type: 'object',
      properties: {
        location_id: { type: 'string', description: 'Filter by location UUID (optional)' },
      },
    },
  },
  {
    name: 'add_teacher',
    description: 'Add a new teacher to the system.',
    inputSchema: {
      type: 'object',
      properties: {
        teacher_id: { type: 'string', description: 'Teacher ID code' },
        full_name: { type: 'string', description: 'Full name' },
        position: { type: 'string', description: 'Position/title' },
        location_id: { type: 'string', description: 'Assigned location UUID (optional)' },
        pin_code: { type: 'string', description: 'PIN code (default: 1234)' },
        is_admin: { type: 'boolean', description: 'Admin privileges (default: false)' },
      },
      required: ['teacher_id', 'full_name'],
    },
  },
  {
    name: 'delete_teacher',
    description: 'Delete a teacher by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        teacher_id: { type: 'string', description: 'Teacher UUID' },
      },
      required: ['teacher_id'],
    },
  },
  {
    name: 'list_attendance_records',
    description: 'List attendance records with filters.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (optional)' },
        location_id: { type: 'string', description: 'Filter by location UUID (optional)' },
        teacher_id: { type: 'string', description: 'Filter by teacher UUID (optional)' },
        limit: { type: 'number', description: 'Limit results (default: 50)' },
      },
    },
  },
  {
    name: 'get_settings',
    description: 'Get current attendance settings (time windows).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_settings',
    description: 'Update attendance time window settings.',
    inputSchema: {
      type: 'object',
      properties: {
        check_in_start: { type: 'string', description: 'Check-in start time (HH:MM)' },
        check_in_end: { type: 'string', description: 'Check-in end time (HH:MM)' },
        check_out_start: { type: 'string', description: 'Check-out start time (HH:MM)' },
        check_out_end: { type: 'string', description: 'Check-out end time (HH:MM)' },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'init_schema': {
        return {
          content: [
            {
              type: 'text',
              text: 'Schema initialization must be done manually via Supabase SQL Editor. Please run the SQL from supabase/schema.sql file.',
            },
          ],
        };
      }

      case 'list_locations': {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('is_headquarters', { ascending: false })
          .order('district');

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'update_location': {
        const { location_id, lat, lng, radius_meters } = args as any;
        const updates: any = {};
        if (lat !== undefined) updates.lat = lat;
        if (lng !== undefined) updates.lng = lng;
        if (radius_meters !== undefined) updates.radius_meters = radius_meters;

        const { data, error } = await supabase
          .from('locations')
          .update(updates)
          .eq('id', location_id)
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Location updated successfully:\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'list_teachers': {
        const { location_id } = args as any;
        let query = supabase
          .from('teachers')
          .select('*, locations(id, short_name, district)')
          .order('created_at');

        if (location_id) {
          query = query.eq('location_id', location_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'add_teacher': {
        const { teacher_id, full_name, position, location_id, pin_code, is_admin } = args as any;
        const { data, error } = await supabase
          .from('teachers')
          .insert({
            teacher_id,
            full_name,
            position: position || '',
            location_id: location_id || null,
            pin_code: pin_code || '1234',
            is_admin: is_admin || false,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Teacher added successfully:\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'delete_teacher': {
        const { teacher_id } = args as any;
        const { error } = await supabase.from('teachers').delete().eq('id', teacher_id);

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Teacher deleted successfully (ID: ${teacher_id})`,
            },
          ],
        };
      }

      case 'list_attendance_records': {
        const { date, location_id, teacher_id, limit } = args as any;
        let query = supabase
          .from('attendance_records')
          .select('*, teachers(full_name, teacher_id), locations(short_name, district)')
          .order('check_in_time', { ascending: false })
          .limit(limit || 50);

        if (date) query = query.eq('date', date);
        if (location_id) query = query.eq('location_id', location_id);
        if (teacher_id) query = query.eq('teacher_id', teacher_id);

        const { data, error } = await query;
        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'get_settings': {
        const { data, error } = await supabase.from('attendance_settings').select('*').single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'update_settings': {
        const { check_in_start, check_in_end, check_out_start, check_out_end } = args as any;
        const updates: any = { updated_at: new Date().toISOString() };
        if (check_in_start) updates.check_in_start = check_in_start;
        if (check_in_end) updates.check_in_end = check_in_end;
        if (check_out_start) updates.check_out_start = check_out_start;
        if (check_out_end) updates.check_out_end = check_out_end;

        const { data, error } = await supabase
          .from('attendance_settings')
          .update(updates)
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .select()
          .single();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Settings updated successfully:\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Face Attendance MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
