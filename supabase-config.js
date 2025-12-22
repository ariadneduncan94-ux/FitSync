// Supabase Configuration for LiftWise
const SUPABASE_URL = 'https://brmxwnvwpgjmmjgqtzty.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybXh3bnZ3cGdqbW1qZ3F0enR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0Mzg2ODksImV4cCI6MjA4MjAxNDY4OX0.sxAXUKgSgex9FSRReqNcFmpnAqlkN--QMPfXzfgee6k';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Demo mode - use a fixed trainer ID for now (no auth required)
const DEMO_TRAINER_ID = '00000000-0000-0000-0000-000000000001';

// ==================== PROGRAMS ====================

// Save a new program
async function saveProgram(programData) {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      trainer_id: DEMO_TRAINER_ID,
      name: programData.name,
      description: programData.description || '',
      duration_weeks: programData.weeks || 4,
      days_per_week: programData.daysPerWeek || 7,
      program_type: programData.type || 'general',
      difficulty: programData.difficulty || 'intermediate',
      is_template: programData.isTemplate || false
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error saving program:', error);
    return { error };
  }
  
  // Save weeks
  if (programData.weeksData) {
    for (const week of programData.weeksData) {
      await saveProgramWeek(data.id, week);
    }
  }
  
  return { data };
}

// Save program week with days and exercises
async function saveProgramWeek(programId, weekData) {
  const { data: week, error: weekError } = await supabase
    .from('program_weeks')
    .insert({
      program_id: programId,
      week_number: weekData.weekNumber,
      name: weekData.name || `Week ${weekData.weekNumber}`
    })
    .select()
    .single();
  
  if (weekError) {
    console.error('Error saving week:', weekError);
    return { error: weekError };
  }
  
  // Save days
  if (weekData.days) {
    for (const day of weekData.days) {
      await saveProgramDay(week.id, day);
    }
  }
  
  return { data: week };
}

// Save program day with exercises
async function saveProgramDay(weekId, dayData) {
  const { data: day, error: dayError } = await supabase
    .from('program_days')
    .insert({
      week_id: weekId,
      day_number: dayData.dayNumber,
      name: dayData.name || '',
      focus: dayData.focus || ''
    })
    .select()
    .single();
  
  if (dayError) {
    console.error('Error saving day:', dayError);
    return { error: dayError };
  }
  
  // Save exercises
  if (dayData.exercises && dayData.exercises.length > 0) {
    const exercisesToInsert = dayData.exercises.map((ex, index) => ({
      day_id: day.id,
      exercise_id: ex.id,
      exercise_name: ex.name,
      exercise_data: { gifUrl: ex.gifUrl, muscle: ex.muscle, equipment: ex.equipment },
      order_index: index,
      sets: ex.sets || []
    }));
    
    const { error: exError } = await supabase
      .from('program_exercises')
      .insert(exercisesToInsert);
    
    if (exError) console.error('Error saving exercises:', exError);
  }
  
  return { data: day };
}

// Load all programs for trainer
async function loadPrograms() {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('trainer_id', DEMO_TRAINER_ID)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading programs:', error);
    return { error };
  }
  
  return { data };
}

// Load full program with weeks, days, exercises
async function loadProgramFull(programId) {
  // Get program
  const { data: program, error: progError } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single();
  
  if (progError) return { error: progError };
  
  // Get weeks
  const { data: weeks } = await supabase
    .from('program_weeks')
    .select('*')
    .eq('program_id', programId)
    .order('week_number');
  
  // Get days for each week
  for (const week of weeks || []) {
    const { data: days } = await supabase
      .from('program_days')
      .select('*')
      .eq('week_id', week.id)
      .order('day_number');
    
    // Get exercises for each day
    for (const day of days || []) {
      const { data: exercises } = await supabase
        .from('program_exercises')
        .select('*')
        .eq('day_id', day.id)
        .order('order_index');
      
      day.exercises = exercises || [];
    }
    
    week.days = days || [];
  }
  
  program.weeks = weeks || [];
  return { data: program };
}

// Update program
async function updateProgram(programId, updates) {
  const { data, error } = await supabase
    .from('programs')
    .update(updates)
    .eq('id', programId)
    .select()
    .single();
  
  return { data, error };
}

// Delete (archive) program
async function archiveProgram(programId) {
  return updateProgram(programId, { is_archived: true });
}

// ==================== CLIENTS ====================

// Load all clients
async function loadClients() {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      profile:profiles(full_name, email, avatar_url)
    `)
    .eq('trainer_id', DEMO_TRAINER_ID)
    .eq('status', 'active');
  
  if (error) {
    console.error('Error loading clients:', error);
    return { error };
  }
  
  return { data };
}

// ==================== SESSIONS ====================

// Load sessions for date range
async function loadSessions(startDate, endDate) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      client:clients(id, profile:profiles(full_name))
    `)
    .eq('trainer_id', DEMO_TRAINER_ID)
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .order('session_date')
    .order('start_time');
  
  return { data, error };
}

// Create session
async function createSession(sessionData) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      trainer_id: DEMO_TRAINER_ID,
      ...sessionData
    })
    .select()
    .single();
  
  return { data, error };
}

// ==================== UTILITY ====================

// Check Supabase connection
async function checkConnection() {
  try {
    const { data, error } = await supabase.from('programs').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
    return false;
  }
}

// Run connection check on load
checkConnection();
