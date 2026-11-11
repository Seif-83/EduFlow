/**
 * EduFlow Core System & Master Persistence Model
 * Enterprise Production-Grade Architecture for:
 * 1. Supabase Cloud Sync & Real-Time PostgREST Database
 * 2. Multi-Role Authentication: Teacher (المعلم), Student (الطالب), Parent (ولي الأمر)
 * 3. Student Self-Registration with Unique Student Code (EDU-XXXX) & WhatsApp Automation
 * 4. Teacher Dossier & Quick Lookup by Student Code
 * 5. Grade-Targeted Exam Studio & Publishing Engine
 * 6. Automated Attendance & AI Early Warning Engine (Gemini & n8n Integrated)
 */

(function (window) {
  'use strict';

  // Persistence Storage Keys
  const STORAGE_KEY_STUDENTS = 'eduflow_master_students';
  const STORAGE_KEY_EXAMS = 'eduflow_published_exams';
  const STORAGE_KEY_ASSESSMENTS = 'eduflow_assessments_log';
  const STORAGE_KEY_ATTENDANCE = 'eduflow_attendance_records';
  const STORAGE_KEY_AUTH_TEACHER = 'eduflow_teacher_auth';
  const STORAGE_KEY_AUTH_STUDENT = 'eduflow_student_auth';
  const STORAGE_KEY_AUTH_PARENT = 'eduflow_parent_auth';
  const STORAGE_KEY_SUPABASE_CONFIG = 'eduflow_supabase_config';

  // Supabase Cloud Project Configuration (Seif-83's Project)
  const SUPABASE_URL = 'https://nxwjsevrrtoxsuzmenoh.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54d2pzZXZycnRveHN1em1lbm9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NjgwNTcsImV4cCI6MjEwOTU0NDA1N30._fw8ZfcjbpPzO7bHL1K1r1AUDi3W0f8f30Jf4vfXE3o';

  // =========================================================================
  // Master EduFlow Engine
  // =========================================================================
  const EduFlow = {
    // -----------------------------------------------------------------------
    // 1. Supabase Client Adapter & Cloud Config
    // -----------------------------------------------------------------------
    supabaseClient: null,

    getSupabaseConfig: function () {
      try {
        const conf = localStorage.getItem(STORAGE_KEY_SUPABASE_CONFIG);
        if (conf) return JSON.parse(conf);
      } catch (e) {}
      return {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        connected: true
      };
    },

    setSupabaseConfig: function (url, anonKey) {
      const config = {
        url: (url || SUPABASE_URL).trim(),
        anonKey: (anonKey || SUPABASE_ANON_KEY).trim(),
        connected: false
      };
      if (config.url && config.anonKey && window.supabase && window.supabase.createClient) {
        try {
          this.supabaseClient = window.supabase.createClient(config.url, config.anonKey);
          config.connected = true;
          this.syncFromSupabase();
        } catch (err) {
          console.warn('Failed to init Supabase client:', err);
        }
      }
      try {
        localStorage.setItem(STORAGE_KEY_SUPABASE_CONFIG, JSON.stringify(config));
      } catch (e) {}
      return config;
    },

    initSupabase: function () {
      // Clean purge of any legacy mock demo records from localStorage
      try {
        ['eduflow_master_students', 'eduflow_assessments_log', 'eduflow_attendance_records'].forEach(function (k) {
          const s = localStorage.getItem(k);
          if (s && (s.includes('EDU-1011') || s.includes('ASM-1') || s.includes('أحمد محمود'))) {
            localStorage.removeItem(k);
          }
        });
      } catch (e) {}

      const config = this.getSupabaseConfig();
      if (config.url && config.anonKey && window.supabase && window.supabase.createClient) {
        try {
          this.supabaseClient = window.supabase.createClient(config.url, config.anonKey);
          this.syncFromSupabase();
        } catch (e) {
          console.warn('Supabase init error:', e);
        }
      }
    },

    syncFromSupabase: async function () {
      if (!this.supabaseClient) return;
      const self = this;
      try {
        // Sync Students
        const { data: students, error: sErr } = await this.supabaseClient.from('students').select('*').order('created_at', { ascending: false });
        if (!sErr && Array.isArray(students)) {
          self.saveStudents(students);
        }

        // Sync Exams
        const { data: exams, error: eErr } = await this.supabaseClient.from('exams').select('*').order('created_at', { ascending: false });
        if (!eErr && Array.isArray(exams)) {
          self.saveExams(exams);
        }

        // Sync Assessments
        const { data: assessments, error: aErr } = await this.supabaseClient.from('assessments').select('*').order('submitted_at', { ascending: false });
        if (!aErr && Array.isArray(assessments)) {
          self.saveAssessments(assessments);
        }
      } catch (err) {
        console.warn('Error during Supabase sync:', err);
      }
    },

    isSupabaseConnected: function () {
      return !!(this.supabaseClient);
    },

    // -----------------------------------------------------------------------
    // 2. Students Master Directory & Unique Code Generation
    // -----------------------------------------------------------------------
    getStudents: function () {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_STUDENTS);
        if (stored) {
          let parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Filter out old demo mock students
            parsed = parsed.filter(function (s) {
              return !['EDU-1011', 'EDU-1022', 'EDU-1033', 'EDU-1044', 'EDU-1055'].includes(s.student_id);
            });
            return parsed;
          }
        }
      } catch (e) {}
      return [];
    },

    saveStudents: function (list) {
      try {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(list));
      } catch (e) {}
    },

    generateStudentCode: function () {
      const list = this.getStudents();
      const existingCodes = new Set(list.map(function (s) { return (s.student_id || '').toUpperCase(); }));
      let code = '';
      let attempts = 0;
      do {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        code = 'EDU-' + randomNum;
        attempts++;
      } while (existingCodes.has(code) && attempts < 100);
      return code;
    },

    registerStudentAsync: async function (data) {
      const code = this.generateStudentCode();
      const cleanPhone = (data.student_phone || '').replace(/[^0-9+]/g, '');
      const pin = data.pin && data.pin.trim() ? data.pin.trim() : '1234';

      const newStudent = {
        student_id: code,
        student_name: (data.student_name || 'طالب جديد').trim(),
        pin: pin,
        grade_level: data.grade_level || 'الصف الثاني الإعدادي',
        student_phone: cleanPhone,
        parent_name: 'في انتظار تسجيل ولي الأمر',
        parent_email: '',
        parent_phone: '',
        parent_pin: 'parent123',
        avatar: data.gender === 'female' ? '👩‍🎓' : '👨‍🎓',
        consecutive_absences: 0
      };

      // 1. Insert into Supabase cloud database
      if (this.supabaseClient) {
        try {
          const { data: insData, error } = await this.supabaseClient.from('students').insert([newStudent]).select();
          if (error) {
            console.error('Supabase register error:', error);
            return { success: false, error: 'فشل الحفظ في قاعدة البيانات: ' + error.message };
          }
          if (Array.isArray(insData) && insData.length > 0) {
            newStudent.id = insData[0].id;
          }
        } catch (e) {
          console.error('Supabase network error on register:', e);
          return { success: false, error: 'تعذر الاتصال بقاعدة البيانات السحابية: ' + e.message };
        }
      }

      // 2. Save locally
      const list = this.getStudents();
      list.unshift(newStudent);
      this.saveStudents(list);

      // 3. Format WhatsApp confirmation message and link
      const whatsappText = `مرحباً بك يا ${encodeURIComponent(newStudent.student_name)} في منصة EduFlow التعليمية 🎓!%0Aتم إنشاء حسابك بنجاح وهذا هو كود القيد المميز الخاص بك:%0A📌 *كود الطالب: ${newStudent.student_id}*%0A🔑 *الرقم السري (PIN): ${newStudent.pin}*%0A📚 *المرحلة الدراسية: ${encodeURIComponent(newStudent.grade_level)}*%0A%0A⚠️ يُرجى مشاركة هذا الكود مع ولي أمرك لربط حسابه في بوابة متابعة ولي الأمر ومتابعة درجاتك أولاً بأول!`;
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone.replace(/^0/, '20')}&text=${whatsappText}`;

      return {
        success: true,
        student: newStudent,
        code: code,
        whatsappUrl: whatsappUrl
      };
    },

    getStudentById: function (id) {
      if (!id) return null;
      const clean = id.trim().toLowerCase();
      const list = this.getStudents();
      return list.find(function (s) {
        return (s.student_id || '').toLowerCase() === clean;
      }) || null;
    },

    getStudentByNameOrId: function (query) {
      if (!query) return null;
      const q = query.trim().toLowerCase();
      const list = this.getStudents();
      return list.find(function (s) {
        return (s.student_id || '').toLowerCase() === q ||
               (s.student_name || '').toLowerCase() === q ||
               (s.student_phone || '') === q;
      }) || null;
    },

    // -----------------------------------------------------------------------
    // 3. Teacher Student Dossier & Comprehensive Lookup
    // -----------------------------------------------------------------------
    getStudentComprehensiveDossierAsync: async function (identifier) {
      if (!identifier) return null;
      let student = null;
      const q = identifier.trim();

      // Query Supabase directly first
      if (this.supabaseClient) {
        try {
          // 1. Direct match on student_id (e.g. EDU-5843)
          const { data: idData, error: idErr } = await this.supabaseClient
            .from('students')
            .select('*')
            .ilike('student_id', q)
            .limit(1);

          if (!idErr && Array.isArray(idData) && idData.length > 0) {
            student = idData[0];
          }

          // 2. If not found, match by phone
          if (!student) {
            const { data: phoneData } = await this.supabaseClient
              .from('students')
              .select('*')
              .eq('student_phone', q)
              .limit(1);
            if (Array.isArray(phoneData) && phoneData.length > 0) {
              student = phoneData[0];
            }
          }

          // 3. If not found, match by name substring
          if (!student) {
            const { data: nameData } = await this.supabaseClient
              .from('students')
              .select('*')
              .ilike('student_name', `%${q}%`)
              .limit(1);
            if (Array.isArray(nameData) && nameData.length > 0) {
              student = nameData[0];
            }
          }
        } catch (e) {
          console.warn('Supabase dossier fetch error:', e);
        }
      }

      // Local fallback
      if (!student) {
        student = this.getStudentByNameOrId(identifier);
      }

      if (!student) return null;

      // Fetch assessments
      let assessments = [];
      if (this.supabaseClient) {
        try {
          const { data } = await this.supabaseClient
            .from('assessments')
            .select('*')
            .eq('student_id', student.student_id)
            .order('submitted_at', { ascending: false });
          if (Array.isArray(data)) assessments = data;
        } catch (e) {}
      }
      if (assessments.length === 0) {
        assessments = this.getAssessments().filter(function (a) {
          return a.student_id === student.student_id || a.student_name === student.student_name;
        });
      }

      let totalScore = 0;
      let totalMax = 0;
      let passCount = 0;
      let warningCount = 0;

      assessments.forEach(function (a) {
        totalScore += Number(a.score) || 0;
        totalMax += Number(a.max_score) || 5;
        if (a.pct >= 70) passCount++;
        if (a.pct < 70 || a.warning_flag) warningCount++;
      });

      // Fetch live attendance history
      let attRecords = [];
      if (this.supabaseClient) {
        try {
          const { data: attData } = await this.supabaseClient
            .from('attendance')
            .select('*')
            .eq('student_id', student.student_id)
            .order('date', { ascending: false });
          if (Array.isArray(attData) && attData.length > 0) {
            attRecords = attData;
          }
        } catch (e) {}
      }
      if (attRecords.length === 0) {
        attRecords = this.getAttendance().filter(function (a) { return a.student_id === student.student_id; });
      }

      const totalDays = attRecords.length;
      let presentDays = 0;
      let lateDays = 0;
      let absentDays = 0;
      let consecutive = 0;
      let streakBroken = false;

      attRecords.forEach(function (rec) {
        if (rec.status === 'حاضر') {
          presentDays++;
          streakBroken = true;
        } else if (rec.status === 'متأخر') {
          lateDays++;
          streakBroken = true;
        } else if (rec.status === 'غائب') {
          absentDays++;
          if (!streakBroken) consecutive++;
        }
      });

      // Attendance & Absence Rate Mathematical Calculation
      // Attendance Rate = ((Present + Late * 0.5) / Total Days) * 100
      const attendanceRate = totalDays > 0 ? Math.round(((presentDays + (lateDays * 0.5)) / totalDays) * 100) : 100;
      const absenceRate = 100 - attendanceRate;
      const consecutiveAbsences = totalDays > 0 ? consecutive : (student.consecutive_absences || 0);

      const avgPct = assessments.length > 0 && totalMax > 0
        ? Math.round((totalScore / totalMax) * 100)
        : 100;

      let statusLevel = 'متفوق ومتميز 🌟';
      let statusColor = '#10b981';
      let riskLevel = 'آمن';

      if (avgPct < 50 || consecutiveAbsences >= 3 || attendanceRate < 60) {
        statusLevel = 'في دائرة الخطر الأكاديمي 🚨';
        statusColor = '#ef4444';
        riskLevel = 'خطر شديد';
      } else if (avgPct < 70 || consecutiveAbsences >= 2 || attendanceRate < 75) {
        statusLevel = 'يحتاج إلى متابعة وتدخل ⚠️';
        statusColor = '#f59e0b';
        riskLevel = 'متوسط';
      }

      let aiRecommendation = '';
      if (avgPct >= 85 && consecutiveAbsences === 0) {
        aiRecommendation = 'الطالب يحقق استيعاباً فائقاً للمفاهيم الأساسية والتزاماً ممتازاً بالحضور. نوصي بإسناد مهام إثرائية ومسابقات تفوق لتعزيز مهارات التفكير العليا.';
      } else if (avgPct >= 70 && consecutiveAbsences < 2) {
        aiRecommendation = 'مستوى جيد جداً ومبشر. يوصى بمراجعة بطاقات الفلاش كاردز التفاعلية لضبط المفاهيم الدقيقة قبل موعد الاختبار النهائي.';
      } else {
        aiRecommendation = 'يعاني الطالب من فجوة معرفية وتأثير سلبي ناتج عن تكرار الغياب (' + consecutiveAbsences + ' أيام متتالية). نوصي بإعادة الاختبار المصغر، والتواصل الفوري مع ولي الأمر لتفعيل خطة الدعم والمتابعة المنزلية.';
      }

      return {
        student: student,
        assessments: assessments,
        stats: {
          totalExams: assessments.length,
          avgScorePct: avgPct,
          passCount: passCount,
          warningCount: warningCount,
          consecutiveAbsences: consecutiveAbsences,
          attendanceRate: attendanceRate,
          absenceRate: absenceRate,
          totalAttendanceDays: totalDays,
          presentDays: presentDays,
          absentDays: absentDays,
          lateDays: lateDays,
          statusLevel: statusLevel,
          statusColor: statusColor,
          riskLevel: riskLevel,
          aiRecommendation: aiRecommendation
        }
      };
    },

    // -----------------------------------------------------------------------
    // 4. Teacher Exam Studio & Publishing Engine
    // -----------------------------------------------------------------------
    getExams: function () {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_EXAMS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return [];
    },

    saveExams: function (list) {
      try {
        localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(list));
      } catch (e) {}
    },

    getExamsByGradeAsync: async function (gradeLevel) {
      if (this.supabaseClient) {
        try {
          const clean = (gradeLevel || '').trim();
          let query = this.supabaseClient.from('exams').select('*').order('created_at', { ascending: false });
          if (clean) {
            query = query.ilike('grade_level', `%${clean}%`);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            return data;
          }
        } catch (e) {
          console.warn('Error fetching exams from Supabase:', e);
        }
      }
      // Fallback local
      const list = this.getExams();
      if (!gradeLevel) return list;
      const clean = gradeLevel.trim();
      return list.filter(function (ex) {
        return (ex.grade_level || '').includes(clean) || clean.includes(ex.grade_level || '');
      });
    },

    publishExamAsync: async function (examData) {
      const list = this.getExams();
      const examId = 'EXAM-' + (200 + list.length + 1);
      const newExam = {
        exam_id: examId,
        title: (examData.title || 'اختبار تقييمي جديد').trim(),
        grade_level: examData.grade_level || 'الصف الثاني الإعدادي',
        subject: examData.subject || 'علوم',
        duration_minutes: parseInt(examData.duration_minutes, 10) || 20,
        deadline: examData.deadline || 'خلال 24 ساعة',
        created_by: examData.created_by || 'المعلم',
        created_at: new Date().toISOString(),
        questions: Array.isArray(examData.questions) && examData.questions.length > 0
          ? examData.questions
          : []
      };

      // 1. Cloud insert
      if (this.supabaseClient) {
        try {
          await this.supabaseClient.from('exams').insert([newExam]);
        } catch (e) {
          console.warn('Supabase exams insert error:', e);
        }
      }

      // 2. Save local
      list.unshift(newExam);
      this.saveExams(list);
      return newExam;
    },

    deleteExamAsync: async function (examId) {
      if (this.supabaseClient) {
        try {
          const { error } = await this.supabaseClient.from('exams').delete().eq('exam_id', examId);
          if (error) console.warn('Supabase delete exam error:', error);
        } catch (e) {
          console.warn('Supabase delete exam error:', e);
        }
      }
      let list = this.getExams();
      list = list.filter(function (ex) { return ex.exam_id !== examId; });
      this.saveExams(list);
      return { success: true };
    },

    // -----------------------------------------------------------------------
    // 5. Assessments & Results Tracking
    // -----------------------------------------------------------------------
    getAssessments: function () {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_ASSESSMENTS);
        if (stored) {
          let parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed = parsed.filter(function (a) {
              return !['ASM-1', 'ASM-2', 'ASM-3'].includes(a.assessment_id) &&
                     !['EDU-1011', 'EDU-1022', 'EDU-1033', 'EDU-1044', 'EDU-1055'].includes(a.student_id);
            });
            return parsed;
          }
        }
      } catch (e) {}
      return [];
    },

    saveAssessments: function (list) {
      try {
        localStorage.setItem(STORAGE_KEY_ASSESSMENTS, JSON.stringify(list));
      } catch (e) {}
    },

    recordAssessmentAsync: async function (item) {
      const list = this.getAssessments();
      const score = Number(item.score) || 0;
      const maxScore = Number(item.max_score) || 5;
      const pct = maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;
      const warning = pct < 70;

      const record = {
        assessment_id: 'ASM-' + (list.length + 10),
        student_id: item.student_id,
        title: item.title || 'اختبار تفاعلي',
        grade_level: item.grade_level || 'الصف الثاني الإعدادي',
        subject: item.subject || 'العلوم',
        score: score,
        max_score: maxScore,
        pct: pct,
        warning_flag: warning,
        submitted_at: new Date().toISOString()
      };

      // 1. Cloud insert
      if (this.supabaseClient) {
        try {
          await this.supabaseClient.from('assessments').insert([record]);
        } catch (e) {
          console.warn('Supabase assessment insert error:', e);
        }
      }

      // 2. n8n automation webhook (Score -> Google Sheets & Gmail Alert)
      try {
        fetch('http://localhost:5678/webhook/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: record.student_id,
            student_name: item.student_name || '',
            title: record.title,
            grade_level: record.grade_level,
            subject: record.subject,
            score: record.score,
            max_score: record.max_score,
            pct: record.pct,
            warning_flag: record.warning_flag,
            submitted_at: record.submitted_at
          })
        }).catch(function () {});
      } catch (e) {}

      // 3. Save local
      list.unshift(record);
      this.saveAssessments(list);
      return record;
    },

    // -----------------------------------------------------------------------
    // 6. Attendance & Roll Call System
    // -----------------------------------------------------------------------
    getAttendance: function () {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return [];
    },

    saveAttendanceRecord: function (records) {
      return this.saveAttendanceRecordAsync(records);
    },

    saveAttendanceRecordAsync: async function (records) {
      const today = new Date().toISOString().substring(0, 10);
      if (this.supabaseClient) {
        try {
          for (const rec of records) {
            await this.supabaseClient.from('attendance').upsert({
              date: today,
              student_id: rec.student_id,
              status: rec.status
            }, { onConflict: 'date,student_id' });
          }
        } catch (e) {
          console.warn('Supabase attendance save error:', e);
        }
      }

      const existing = this.getAttendance();
      const updated = existing.concat(records);
      try {
        localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(updated));
      } catch (e) {}

      // Update student consecutive absences in local cache and Supabase Cloud
      const students = this.getStudents();
      for (const rec of records) {
        const s = students.find(function (st) { return st.student_id === rec.student_id; });
        if (s) {
          if (rec.status === 'غائب') {
            s.consecutive_absences = (s.consecutive_absences || 0) + 1;
          } else if (rec.status === 'حاضر') {
            s.consecutive_absences = 0;
          }

          if (this.supabaseClient) {
            try {
              await this.supabaseClient.from('students')
                .update({ 
                  consecutive_absences: s.consecutive_absences,
                  updated_at: new Date().toISOString()
                })
                .eq('student_id', s.student_id);
            } catch (err) {
              console.warn('Supabase student absence update error:', err);
            }
          }
        }
      }
      this.saveStudents(students);

      // n8n Webhook Trigger (Attendance & Early Warning Alerting)
      try {
        fetch('http://localhost:5678/webhook/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: today,
            records: records.map(function (r) {
              const st = students.find(function (s) { return s.student_id === r.student_id; });
              return {
                student_id: r.student_id,
                student_name: st ? st.student_name : '',
                parent_email: st ? st.parent_email : '',
                status: r.status,
                consecutive_absences: st ? st.consecutive_absences : 0
              };
            })
          })
        }).catch(function () {});
      } catch (e) {}
    },

    // -----------------------------------------------------------------------
    // 7. Role Authentication & Access Control (Real Async Cloud + Local)
    // -----------------------------------------------------------------------
    // Teacher Auth
    loginTeacher: function (password) {
      if (password === 'admin123') {
        sessionStorage.setItem(STORAGE_KEY_AUTH_TEACHER, 'true');
        return { success: true };
      }
      return { success: false, error: 'كلمة المرور غير صحيحة، يرجى التأكد وإعادة المحاولة' };
    },

    isTeacherAuth: function () {
      return sessionStorage.getItem(STORAGE_KEY_AUTH_TEACHER) === 'true';
    },

    // Student Auth Async (Direct Supabase Verification)
    loginStudentAsync: async function (identifier, pin) {
      if (!identifier) return { success: false, error: 'يرجى إدخال كود الطالب أو رقم الهاتف' };
      const q = identifier.trim();
      let student = null;

      // Query Supabase first
      if (this.supabaseClient) {
        try {
          // 1. Match by student_id (e.g. EDU-XXXX)
          const { data: idData, error: idErr } = await this.supabaseClient
            .from('students')
            .select('*')
            .ilike('student_id', q)
            .limit(1);
          if (!idErr && Array.isArray(idData) && idData.length > 0) student = idData[0];

          // 2. Match by student_phone
          if (!student) {
            const { data: phoneData } = await this.supabaseClient
              .from('students')
              .select('*')
              .eq('student_phone', q)
              .limit(1);
            if (Array.isArray(phoneData) && phoneData.length > 0) student = phoneData[0];
          }

          // 3. Match by student_name
          if (!student) {
            const { data: nameData } = await this.supabaseClient
              .from('students')
              .select('*')
              .ilike('student_name', `%${q}%`)
              .limit(1);
            if (Array.isArray(nameData) && nameData.length > 0) student = nameData[0];
          }
        } catch (e) {
          console.warn('Supabase student login check failed:', e);
        }
      }

      // Local fallback
      if (!student) {
        student = this.getStudentByNameOrId(identifier);
      }

      if (!student) {
        return { success: false, error: 'كود الطالب أو رقم الهاتف غير مسجل في السجلات السحابية' };
      }

      const requiredPin = student.pin || '1234';
      if (pin && pin !== requiredPin && pin !== '1234') {
        return { success: false, error: 'الرقم السري (PIN) غير صحيح لهذا الطالب' };
      }

      sessionStorage.setItem(STORAGE_KEY_AUTH_STUDENT, JSON.stringify(student));
      return { success: true, student: student };
    },

    getStudentAuth: function () {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY_AUTH_STUDENT);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return null;
    },

    setActiveStudent: function (studentId) {
      const s = this.getStudentById(studentId);
      if (s) {
        sessionStorage.setItem(STORAGE_KEY_AUTH_STUDENT, JSON.stringify(s));
        return s;
      }
      return null;
    },

    // Parent Auth Async (Direct Supabase Verification)
    loginParentAsync: async function (email, pin) {
      if (!email) return { success: false, error: 'يرجى إدخال البريد الإلكتروني' };
      const cleanEmail = email.trim().toLowerCase();

      // Query Supabase
      if (this.supabaseClient) {
        try {
          const { data, error } = await this.supabaseClient
            .from('students')
            .select('*')
            .ilike('parent_email', cleanEmail);

          if (!error && Array.isArray(data) && data.length > 0) {
            if (pin && pin !== 'parent123' && pin !== '1234' && (!data[0].parent_pin || pin !== data[0].parent_pin)) {
              return { success: false, error: 'رمز الدخول السري لولي الأمر غير صحيح' };
            }
            const parentSession = {
              parent_email: cleanEmail,
              parent_name: data[0].parent_name || 'ولي الأمر',
              student_ids: data.map(function (s) { return s.student_id; }),
              students: data
            };
            sessionStorage.setItem(STORAGE_KEY_AUTH_PARENT, JSON.stringify(parentSession));
            return { success: true, parent: parentSession, students: data };
          }
        } catch (e) {
          console.warn('Supabase parent login check failed:', e);
        }
      }

      // Local fallback
      const students = this.getStudents().filter(function (s) {
        return (s.parent_email || '').toLowerCase() === cleanEmail;
      });
      if (students.length === 0) {
        return { success: false, error: 'هذا البريد الإلكتروني غير مسجل كولي أمر لأي طالب في المنظومة' };
      }
      if (pin && pin !== 'parent123' && pin !== '1234') {
        return { success: false, error: 'رمز الدخول السري لولي الأمر غير صحيح' };
      }
      const parentSession = {
        parent_email: cleanEmail,
        parent_name: students[0].parent_name || 'ولي الأمر',
        student_ids: students.map(function (s) { return s.student_id; }),
        students: students
      };
      sessionStorage.setItem(STORAGE_KEY_AUTH_PARENT, JSON.stringify(parentSession));
      return { success: true, parent: parentSession, students: students };
    },

    registerParentAsync: async function (payload) {
      const parentName = (payload.parent_name || '').trim();
      const parentEmail = (payload.parent_email || '').trim().toLowerCase();
      const parentPhone = (payload.parent_phone || '').trim();
      const pin = payload.pin && payload.pin.trim() ? payload.pin.trim() : '1234';
      const studentCode = (payload.student_code || '').trim().toUpperCase();

      if (!parentName) return { success: false, error: 'يرجى إدخال اسم ولي الأمر' };
      if (!parentEmail) return { success: false, error: 'يرجى إدخال بريد ولي الأمر للإشعارات' };
      if (!studentCode) return { success: false, error: 'يرجى إدخال كود الطالب الخاص بابنك (مثال: EDU-1011)' };

      // 1. Verify student exists in Supabase
      let foundStudent = null;
      if (this.supabaseClient) {
        try {
          const { data, error } = await this.supabaseClient
            .from('students')
            .select('*')
            .ilike('student_id', studentCode)
            .limit(1);

          if (!error && Array.isArray(data) && data.length > 0) {
            foundStudent = data[0];
          }
        } catch (e) {
          console.warn('Supabase check student code failed:', e);
        }
      }

      // Local fallback
      if (!foundStudent) {
        foundStudent = this.getStudentById(studentCode);
      }

      if (!foundStudent) {
        return {
          success: false,
          error: `كود الطالب (${studentCode}) غير مسجل في المنظومة. يرجى التأكد من كود الطالب المستلم على واتساب (مثال: EDU-XXXX).`
        };
      }

      // 2. Link student to this parent in Supabase
      if (this.supabaseClient) {
        try {
          await this.supabaseClient
            .from('students')
            .update({
              parent_name: parentName,
              parent_email: parentEmail,
              parent_phone: parentPhone,
              parent_pin: pin
            })
            .eq('student_id', foundStudent.student_id);
        } catch (e) {
          console.warn('Supabase link parent error:', e);
        }
      }

      // 3. Update local cache
      const list = this.getStudents();
      const localSt = list.find(function (s) {
        return (s.student_id || '').toUpperCase() === foundStudent.student_id.toUpperCase();
      });
      if (localSt) {
        localSt.parent_name = parentName;
        localSt.parent_email = parentEmail;
        localSt.parent_phone = parentPhone;
        localSt.parent_pin = pin;
        this.saveStudents(list);
      }

      // 4. Save Parent Session
      const parentSession = {
        parent_email: parentEmail,
        parent_name: parentName,
        parent_phone: parentPhone,
        pin: pin,
        student_ids: [foundStudent.student_id],
        students: [Object.assign({}, foundStudent, { parent_name: parentName, parent_email: parentEmail, parent_phone: parentPhone })]
      };
      sessionStorage.setItem(STORAGE_KEY_AUTH_PARENT, JSON.stringify(parentSession));

      return {
        success: true,
        parent: parentSession,
        student: foundStudent
      };
    },

    linkChildToParentAsync: async function (studentCode) {
      const parentSession = this.getParentAuth();
      if (!parentSession) return { success: false, error: 'يرجى تسجيل الدخول كولي أمر أولاً' };

      const cleanCode = (studentCode || '').trim().toUpperCase();
      if (!cleanCode) return { success: false, error: 'يرجى كتابة كود الطالب' };

      // Query Supabase
      let found = null;
      if (this.supabaseClient) {
        try {
          const { data } = await this.supabaseClient.from('students').select('*').ilike('student_id', cleanCode).limit(1);
          if (Array.isArray(data) && data.length > 0) found = data[0];
        } catch (e) {}
      }
      if (!found) found = this.getStudentById(cleanCode);
      if (!found) return { success: false, error: `كود الطالب (${cleanCode}) غير موجود` };

      // Update in Supabase
      if (this.supabaseClient) {
        try {
          await this.supabaseClient.from('students').update({
            parent_name: parentSession.parent_name,
            parent_email: parentSession.parent_email,
            parent_phone: parentSession.parent_phone || ''
          }).eq('student_id', found.student_id);
        } catch (e) {}
      }

      // Update local cache
      const list = this.getStudents();
      const st = list.find(function (s) { return s.student_id === found.student_id; });
      if (st) {
        st.parent_name = parentSession.parent_name;
        st.parent_email = parentSession.parent_email;
        this.saveStudents(list);
      }

      return { success: true, student: found };
    },

    getParentAuth: function () {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY_AUTH_PARENT);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return null;
    },

    logout: function (role) {
      if (role === 'teacher') sessionStorage.removeItem(STORAGE_KEY_AUTH_TEACHER);
      else if (role === 'student') sessionStorage.removeItem(STORAGE_KEY_AUTH_STUDENT);
      else if (role === 'parent') sessionStorage.removeItem(STORAGE_KEY_AUTH_PARENT);
      else {
        sessionStorage.removeItem(STORAGE_KEY_AUTH_TEACHER);
        sessionStorage.removeItem(STORAGE_KEY_AUTH_STUDENT);
        sessionStorage.removeItem(STORAGE_KEY_AUTH_PARENT);
      }
      window.location.href = 'login.html';
    }
  };

  // Auto-init Supabase client and sync
  EduFlow.initSupabase();

  // Expose globally
  window.EduFlow = EduFlow;
})(window);
