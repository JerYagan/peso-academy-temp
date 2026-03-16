BEGIN;

DO $$
DECLARE
  v_course_id UUID := '5a4cbdef-cbd4-428c-a1d5-dd6a68188794';
  v_course_title TEXT;
  v_module_1_id UUID;
  v_module_2_id UUID;
  v_module_3_id UUID;
  v_module_4_id UUID;
  v_module_5_id UUID;
  v_assessment_id UUID;
  v_pdf TEXT := 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  v_video TEXT := 'https://www.youtube.com/watch?v=DAU0qqh_I-A';
BEGIN
  SELECT title
  INTO v_course_title
  FROM public.courses
  WHERE id = v_course_id;

  IF v_course_title IS NULL THEN
    RAISE EXCEPTION 'Course % was not found in public.courses', v_course_id;
  END IF;

  SELECT id INTO v_module_1_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Excel Fundamentals for Clean Worksheets'
  ORDER BY created_at
  LIMIT 1;

  IF v_module_1_id IS NULL THEN
    INSERT INTO public.modules (
      course_id,
      title,
      description,
      "order",
      content,
      materials,
      prerequisites,
      module_thumbnail,
      module_document,
      status,
      created_at,
      updated_at
    )
    VALUES (
      v_course_id,
      'Excel Fundamentals for Clean Worksheets',
      'Set up structured worksheets, apply consistent formatting, and prepare spreadsheets for analysis.',
      1,
      $module1$
      [
        {
          "id": "excel-fundamentals-text",
          "type": "text",
          "title": "Build a worksheet that stays readable",
          "content": "<p>Good analysis starts with a clean worksheet. Use one header row, avoid merged cells inside your dataset, and keep each column limited to one data type. Structured worksheets reduce formula errors and make sorting, filtering, and charting more reliable.</p><p>Convert raw ranges into Excel tables when possible so formulas and filters stay aligned as the dataset grows.</p>"
        },
        {
          "id": "excel-fundamentals-video",
          "type": "video",
          "title": "Worksheet setup walkthrough",
          "content": "",
          "videoUrl": "https://www.youtube.com/watch?v=DAU0qqh_I-A"
        },
        {
          "id": "excel-fundamentals-material",
          "type": "learning_material",
          "title": "Worksheet cleanup checklist",
          "content": "",
          "materialUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        },
        {
          "id": "excel-fundamentals-quiz",
          "type": "quiz",
          "title": "Quick quiz",
          "content": "Which worksheet design choice best supports accurate sorting and filtering?",
          "options": [
            "A single header row with consistent column types",
            "Merged cells inside the data table",
            "Multiple blank rows between records",
            "Several unrelated values in one column"
          ],
          "correctAnswer": 0,
          "explanation": "Sorting and filtering work best when each column has a clear header and a consistent value type."
        }
      ]
      $module1$,
      ARRAY[v_pdf, v_video],
      ARRAY[]::TEXT[],
      '/images/logo.png',
      v_pdf,
      'finalized',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_module_1_id;
  ELSE
    UPDATE public.modules
    SET description = 'Set up structured worksheets, apply consistent formatting, and prepare spreadsheets for analysis.',
        "order" = 1,
        content = $module1$
        [
          {
            "id": "excel-fundamentals-text",
            "type": "text",
            "title": "Build a worksheet that stays readable",
            "content": "<p>Good analysis starts with a clean worksheet. Use one header row, avoid merged cells inside your dataset, and keep each column limited to one data type. Structured worksheets reduce formula errors and make sorting, filtering, and charting more reliable.</p><p>Convert raw ranges into Excel tables when possible so formulas and filters stay aligned as the dataset grows.</p>"
          },
          {
            "id": "excel-fundamentals-video",
            "type": "video",
            "title": "Worksheet setup walkthrough",
            "content": "",
            "videoUrl": "https://www.youtube.com/watch?v=DAU0qqh_I-A"
          },
          {
            "id": "excel-fundamentals-material",
            "type": "learning_material",
            "title": "Worksheet cleanup checklist",
            "content": "",
            "materialUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
          },
          {
            "id": "excel-fundamentals-quiz",
            "type": "quiz",
            "title": "Quick quiz",
            "content": "Which worksheet design choice best supports accurate sorting and filtering?",
            "options": [
              "A single header row with consistent column types",
              "Merged cells inside the data table",
              "Multiple blank rows between records",
              "Several unrelated values in one column"
            ],
            "correctAnswer": 0,
            "explanation": "Sorting and filtering work best when each column has a clear header and a consistent value type."
          }
        ]
        $module1$,
        materials = ARRAY[v_pdf, v_video],
        prerequisites = ARRAY[]::TEXT[],
        module_thumbnail = '/images/logo.png',
        module_document = v_pdf,
        status = 'finalized',
        updated_at = NOW()
    WHERE id = v_module_1_id;
  END IF;

  SELECT id INTO v_module_2_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Clean and Prepare Data in Excel'
  ORDER BY created_at
  LIMIT 1;

  IF v_module_2_id IS NULL THEN
    INSERT INTO public.modules (
      course_id, title, description, "order", content, materials, prerequisites, module_thumbnail, module_document, status, created_at, updated_at
    )
    VALUES (
      v_course_id,
      'Clean and Prepare Data in Excel',
      'Standardize values, remove duplicates, and handle incomplete records before analysis.',
      2,
      $module2$
      [
        {
          "id": "data-cleaning-text",
          "type": "text",
          "title": "Prepare data before drawing conclusions",
          "content": "<p>Data cleaning reduces the risk of misleading summaries. Standardize capitalization, align date formats, and remove exact duplicates when appropriate. Before deleting anything, inspect the rows and confirm whether duplicates are truly redundant records.</p><p>Flag missing values intentionally so the next analyst knows whether the gap means unavailable, not applicable, or not yet collected.</p>"
        },
        {
          "id": "data-cleaning-code",
          "type": "code",
          "title": "Useful Excel functions",
          "language": "plaintext",
          "content": "=TRIM(A2)\n=UPPER(B2)\n=TEXT(C2, \"yyyy-mm-dd\")\n=IF(D2=\"\", \"Missing\", D2)"
        },
        {
          "id": "data-cleaning-document",
          "type": "document",
          "title": "Data cleaning reference",
          "content": "",
          "documentUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        },
        {
          "id": "data-cleaning-quiz",
          "type": "quiz",
          "title": "Quick quiz",
          "content": "What is the best first step before removing duplicate rows from a spreadsheet?",
          "options": [
            "Review whether the duplicate records are actually redundant",
            "Delete all repeated names immediately",
            "Replace the whole sheet with a screenshot",
            "Ignore duplicates until after charting"
          ],
          "correctAnswer": 0,
          "explanation": "Some repeated values may represent legitimate repeated transactions rather than bad data."
        }
      ]
      $module2$,
      ARRAY[v_pdf],
      ARRAY[]::TEXT[],
      '/images/logo.png',
      v_pdf,
      'finalized',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_module_2_id;
  ELSE
    UPDATE public.modules
    SET description = 'Standardize values, remove duplicates, and handle incomplete records before analysis.',
        "order" = 2,
        content = $module2$
        [
          {
            "id": "data-cleaning-text",
            "type": "text",
            "title": "Prepare data before drawing conclusions",
            "content": "<p>Data cleaning reduces the risk of misleading summaries. Standardize capitalization, align date formats, and remove exact duplicates when appropriate. Before deleting anything, inspect the rows and confirm whether duplicates are truly redundant records.</p><p>Flag missing values intentionally so the next analyst knows whether the gap means unavailable, not applicable, or not yet collected.</p>"
          },
          {
            "id": "data-cleaning-code",
            "type": "code",
            "title": "Useful Excel functions",
            "language": "plaintext",
            "content": "=TRIM(A2)\n=UPPER(B2)\n=TEXT(C2, \"yyyy-mm-dd\")\n=IF(D2=\"\", \"Missing\", D2)"
          },
          {
            "id": "data-cleaning-document",
            "type": "document",
            "title": "Data cleaning reference",
            "content": "",
            "documentUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
          },
          {
            "id": "data-cleaning-quiz",
            "type": "quiz",
            "title": "Quick quiz",
            "content": "What is the best first step before removing duplicate rows from a spreadsheet?",
            "options": [
              "Review whether the duplicate records are actually redundant",
              "Delete all repeated names immediately",
              "Replace the whole sheet with a screenshot",
              "Ignore duplicates until after charting"
            ],
            "correctAnswer": 0,
            "explanation": "Some repeated values may represent legitimate repeated transactions rather than bad data."
          }
        ]
        $module2$,
        materials = ARRAY[v_pdf],
        module_thumbnail = '/images/logo.png',
        module_document = v_pdf,
        status = 'finalized',
        updated_at = NOW()
    WHERE id = v_module_2_id;
  END IF;

  SELECT id INTO v_module_3_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Analyze Data with Formulas and Functions'
  ORDER BY created_at
  LIMIT 1;

  IF v_module_3_id IS NULL THEN
    INSERT INTO public.modules (
      course_id, title, description, "order", content, materials, prerequisites, module_thumbnail, module_document, status, created_at, updated_at
    )
    VALUES (
      v_course_id,
      'Analyze Data with Formulas and Functions',
      'Use core Excel formulas to summarize values, compare categories, and build quick calculations.',
      3,
      $module3$
      [
        {
          "id": "formulas-functions-text",
          "type": "text",
          "title": "Move from raw values to useful summaries",
          "content": "<p>Excel formulas help answer focused questions quickly. Use functions like SUM, AVERAGE, COUNTIF, and SUMIFS to summarize data by condition. Clear cell references and labeled helper columns make formulas easier to audit and reuse.</p><p>Always verify whether you should use relative or absolute references when copying formulas across rows and columns.</p>"
        },
        {
          "id": "formulas-functions-material",
          "type": "learning_material",
          "title": "Formula cheat sheet",
          "content": "",
          "materialUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        },
        {
          "id": "formulas-functions-quiz",
          "type": "quiz",
          "title": "Quick quiz",
          "content": "Which Excel function is most useful when you need to total sales for one specific region only?",
          "options": ["SUMIFS", "LEFT", "TODAY", "TRIM"],
          "correctAnswer": 0,
          "explanation": "SUMIFS is designed for conditional summation based on one or more criteria."
        }
      ]
      $module3$,
      ARRAY[v_pdf, v_video],
      ARRAY[]::TEXT[],
      '/images/logo.png',
      v_pdf,
      'finalized',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_module_3_id;
  ELSE
    UPDATE public.modules
    SET description = 'Use core Excel formulas to summarize values, compare categories, and build quick calculations.',
        "order" = 3,
        content = $module3$
        [
          {
            "id": "formulas-functions-text",
            "type": "text",
            "title": "Move from raw values to useful summaries",
            "content": "<p>Excel formulas help answer focused questions quickly. Use functions like SUM, AVERAGE, COUNTIF, and SUMIFS to summarize data by condition. Clear cell references and labeled helper columns make formulas easier to audit and reuse.</p><p>Always verify whether you should use relative or absolute references when copying formulas across rows and columns.</p>"
          },
          {
            "id": "formulas-functions-material",
            "type": "learning_material",
            "title": "Formula cheat sheet",
            "content": "",
            "materialUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
          },
          {
            "id": "formulas-functions-quiz",
            "type": "quiz",
            "title": "Quick quiz",
            "content": "Which Excel function is most useful when you need to total sales for one specific region only?",
            "options": ["SUMIFS", "LEFT", "TODAY", "TRIM"],
            "correctAnswer": 0,
            "explanation": "SUMIFS is designed for conditional summation based on one or more criteria."
          }
        ]
        $module3$,
        materials = ARRAY[v_pdf, v_video],
        module_thumbnail = '/images/logo.png',
        module_document = v_pdf,
        status = 'finalized',
        updated_at = NOW()
    WHERE id = v_module_3_id;
  END IF;

  SELECT id INTO v_module_4_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Summarize Insights with PivotTables and Charts'
  ORDER BY created_at
  LIMIT 1;

  IF v_module_4_id IS NULL THEN
    INSERT INTO public.modules (
      course_id, title, description, "order", content, materials, prerequisites, module_thumbnail, module_document, status, created_at, updated_at
    )
    VALUES (
      v_course_id,
      'Summarize Insights with PivotTables and Charts',
      'Turn spreadsheet data into summary tables and charts that support reporting and decisions.',
      4,
      $module4$
      [
        {
          "id": "pivots-charts-text",
          "type": "text",
          "title": "Choose the right summary view",
          "content": "<p>PivotTables help summarize large datasets without rewriting formulas for every view. They are useful for grouping results by category, date, or location. Charts then turn those summaries into visuals that support quick interpretation.</p><p>Select chart types that match the question. Bar and column charts compare categories well, while line charts are better for trends over time.</p>"
        },
        {
          "id": "pivots-charts-image",
          "type": "image",
          "title": "Reporting snapshot",
          "content": "",
          "imageUrl": "/images/logo.png",
          "altText": "Placeholder visual for an Excel reporting dashboard",
          "caption": "Replace with a branded chart sample if needed."
        },
        {
          "id": "pivots-charts-quiz",
          "type": "quiz",
          "title": "Quick quiz",
          "content": "Which chart type is usually best for showing month-by-month performance trends?",
          "options": ["Line chart", "Pie chart", "Scatter plot for one value", "Text box"],
          "correctAnswer": 0,
          "explanation": "Line charts are effective for showing direction and change over time."
        }
      ]
      $module4$,
      ARRAY[v_pdf, v_video],
      ARRAY[]::TEXT[],
      '/images/logo.png',
      v_pdf,
      'finalized',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_module_4_id;
  ELSE
    UPDATE public.modules
    SET description = 'Turn spreadsheet data into summary tables and charts that support reporting and decisions.',
        "order" = 4,
        content = $module4$
        [
          {
            "id": "pivots-charts-text",
            "type": "text",
            "title": "Choose the right summary view",
            "content": "<p>PivotTables help summarize large datasets without rewriting formulas for every view. They are useful for grouping results by category, date, or location. Charts then turn those summaries into visuals that support quick interpretation.</p><p>Select chart types that match the question. Bar and column charts compare categories well, while line charts are better for trends over time.</p>"
          },
          {
            "id": "pivots-charts-image",
            "type": "image",
            "title": "Reporting snapshot",
            "content": "",
            "imageUrl": "/images/logo.png",
            "altText": "Placeholder visual for an Excel reporting dashboard",
            "caption": "Replace with a branded chart sample if needed."
          },
          {
            "id": "pivots-charts-quiz",
            "type": "quiz",
            "title": "Quick quiz",
            "content": "Which chart type is usually best for showing month-by-month performance trends?",
            "options": ["Line chart", "Pie chart", "Scatter plot for one value", "Text box"],
            "correctAnswer": 0,
            "explanation": "Line charts are effective for showing direction and change over time."
          }
        ]
        $module4$,
        materials = ARRAY[v_pdf, v_video],
        module_thumbnail = '/images/logo.png',
        module_document = v_pdf,
        status = 'finalized',
        updated_at = NOW()
    WHERE id = v_module_4_id;
  END IF;

  SELECT id INTO v_module_5_id
  FROM public.modules
  WHERE course_id = v_course_id
    AND title = 'Build a Basic Data Analytics Report in Excel'
  ORDER BY created_at
  LIMIT 1;

  IF v_module_5_id IS NULL THEN
    INSERT INTO public.modules (
      course_id, title, description, "order", content, materials, prerequisites, module_thumbnail, module_document, status, created_at, updated_at
    )
    VALUES (
      v_course_id,
      'Build a Basic Data Analytics Report in Excel',
      'Combine cleaned data, formulas, and visuals into a simple report with actionable findings.',
      5,
      $module5$
      [
        {
          "id": "reporting-text",
          "type": "text",
          "title": "Turn analysis into decisions",
          "content": "<p>A basic analytics report should explain what data was reviewed, what patterns were found, and what action the reader should consider next. Use a short summary, one or two supporting tables or charts, and a clear recommendation tied to the numbers.</p><p>Keep the audience in mind. Decision-makers usually want concise findings, not every calculation step.</p>"
        },
        {
          "id": "reporting-code",
          "type": "code",
          "title": "Simple report outline",
          "language": "plaintext",
          "content": "1. Objective\n2. Dataset scope\n3. Key metrics\n4. Chart or table summary\n5. Main finding\n6. Recommendation\n7. Next step"
        },
        {
          "id": "reporting-quiz",
          "type": "quiz",
          "title": "Quick quiz",
          "content": "What makes an analytics report useful to a manager or stakeholder?",
          "options": [
            "It connects findings to a clear recommendation",
            "It lists formulas without any interpretation",
            "It avoids showing any evidence",
            "It uses as many decorative colors as possible"
          ],
          "correctAnswer": 0,
          "explanation": "Reports are most useful when they translate analysis into practical action."
        }
      ]
      $module5$,
      ARRAY[v_pdf],
      ARRAY[]::TEXT[],
      '/images/logo.png',
      v_pdf,
      'finalized',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_module_5_id;
  ELSE
    UPDATE public.modules
    SET description = 'Combine cleaned data, formulas, and visuals into a simple report with actionable findings.',
        "order" = 5,
        content = $module5$
        [
          {
            "id": "reporting-text",
            "type": "text",
            "title": "Turn analysis into decisions",
            "content": "<p>A basic analytics report should explain what data was reviewed, what patterns were found, and what action the reader should consider next. Use a short summary, one or two supporting tables or charts, and a clear recommendation tied to the numbers.</p><p>Keep the audience in mind. Decision-makers usually want concise findings, not every calculation step.</p>"
          },
          {
            "id": "reporting-code",
            "type": "code",
            "title": "Simple report outline",
            "language": "plaintext",
            "content": "1. Objective\n2. Dataset scope\n3. Key metrics\n4. Chart or table summary\n5. Main finding\n6. Recommendation\n7. Next step"
          },
          {
            "id": "reporting-quiz",
            "type": "quiz",
            "title": "Quick quiz",
            "content": "What makes an analytics report useful to a manager or stakeholder?",
            "options": [
              "It connects findings to a clear recommendation",
              "It lists formulas without any interpretation",
              "It avoids showing any evidence",
              "It uses as many decorative colors as possible"
            ],
            "correctAnswer": 0,
            "explanation": "Reports are most useful when they translate analysis into practical action."
          }
        ]
        $module5$,
        materials = ARRAY[v_pdf],
        module_thumbnail = '/images/logo.png',
        module_document = v_pdf,
        status = 'finalized',
        updated_at = NOW()
    WHERE id = v_module_5_id;
  END IF;

  UPDATE public.modules
  SET prerequisites = ARRAY[]::TEXT[]
  WHERE id = v_module_1_id;

  UPDATE public.modules
  SET prerequisites = ARRAY[v_module_1_id::TEXT]
  WHERE id = v_module_2_id;

  UPDATE public.modules
  SET prerequisites = ARRAY[v_module_1_id::TEXT, v_module_2_id::TEXT]
  WHERE id = v_module_3_id;

  UPDATE public.modules
  SET prerequisites = ARRAY[v_module_2_id::TEXT, v_module_3_id::TEXT]
  WHERE id = v_module_4_id;

  UPDATE public.modules
  SET prerequisites = ARRAY[v_module_1_id::TEXT, v_module_2_id::TEXT, v_module_3_id::TEXT, v_module_4_id::TEXT]
  WHERE id = v_module_5_id;

  SELECT id INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Worksheet Setup Assessment'
  ORDER BY created_at
  LIMIT 1;

  IF v_assessment_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, prerequisite_module_ids, display_order, created_at, updated_at
    )
    VALUES (
      v_course_id, NULL, 'Worksheet Setup Assessment', 'Validate the learner''s understanding of spreadsheet structure and data-ready worksheet design.', 12, 75, 3, TRUE, ARRAY[v_module_1_id], 1, NOW(), NOW()
    )
    RETURNING id INTO v_assessment_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Validate the learner''s understanding of spreadsheet structure and data-ready worksheet design.',
        time_limit = 12,
        passing_score = 75,
        max_attempts = 3,
        is_active = TRUE,
        prerequisite_module_ids = ARRAY[v_module_1_id],
        display_order = 1,
        updated_at = NOW()
    WHERE id = v_assessment_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_id;

  INSERT INTO public.assessment_questions (assessment_id, question, question_type, options, correct_answer, points, "order", explanation, created_at)
  VALUES
    (v_assessment_id, 'Why should each column contain a single type of information?', 'multiple_choice', '["It keeps formulas, filters, and analysis consistent", "It makes charts impossible to build", "It removes the need for headers", "It allows every cell to use a different meaning"]'::JSONB, 'It keeps formulas, filters, and analysis consistent', 2, 1, 'Consistent columns make the dataset predictable for Excel tools.', NOW()),
    (v_assessment_id, 'True or false: Blank rows inside the middle of a dataset can interfere with analysis workflows.', 'true_false', NULL, 'true', 1, 2, 'Blank rows can break selections and reduce reliability when sorting or summarizing data.', NOW()),
    (v_assessment_id, 'Which Excel feature helps keep filters and formulas aligned when new rows are added?', 'multiple_choice', '["Excel Table", "Text box", "Comment thread", "Frozen pane only"]'::JSONB, 'Excel Table', 2, 3, 'Excel Tables expand with the dataset and preserve structure-aware behavior.', NOW());

  SELECT id INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Data Cleaning Assessment'
  ORDER BY created_at
  LIMIT 1;

  IF v_assessment_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, prerequisite_module_ids, display_order, created_at, updated_at
    )
    VALUES (
      v_course_id, NULL, 'Data Cleaning Assessment', 'Measure whether the learner can identify practical data-cleaning steps in Excel.', 15, 75, 3, TRUE, ARRAY[v_module_2_id], 2, NOW(), NOW()
    )
    RETURNING id INTO v_assessment_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Measure whether the learner can identify practical data-cleaning steps in Excel.',
        time_limit = 15,
        passing_score = 75,
        max_attempts = 3,
        is_active = TRUE,
        prerequisite_module_ids = ARRAY[v_module_2_id],
        display_order = 2,
        updated_at = NOW()
    WHERE id = v_assessment_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_id;

  INSERT INTO public.assessment_questions (assessment_id, question, question_type, options, correct_answer, points, "order", explanation, created_at)
  VALUES
    (v_assessment_id, 'Why is standardizing date format useful before analysis?', 'multiple_choice', '["It helps Excel sort and compare dates correctly", "It removes the need for validation", "It turns every value into plain text on purpose", "It prevents filtering by month"]'::JSONB, 'It helps Excel sort and compare dates correctly', 2, 1, 'Inconsistent date formats can break chronological sorting and aggregation.', NOW()),
    (v_assessment_id, 'True or false: Missing values should be interpreted the same way in every dataset without review.', 'true_false', NULL, 'false', 1, 2, 'Missing values can mean different things depending on the data collection context.', NOW()),
    (v_assessment_id, 'Which function helps remove extra spaces from imported text data?', 'multiple_choice', '["TRIM", "RAND", "NOW", "COUNTIF"]'::JSONB, 'TRIM', 2, 3, 'TRIM removes extra spaces that often appear in copied or imported data.', NOW());

  SELECT id INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Formula Analysis Assessment'
  ORDER BY created_at
  LIMIT 1;

  IF v_assessment_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, prerequisite_module_ids, display_order, created_at, updated_at
    )
    VALUES (
      v_course_id, NULL, 'Formula Analysis Assessment', 'Check whether the learner can match common analysis needs with the right Excel functions.', 15, 75, 3, TRUE, ARRAY[v_module_3_id], 3, NOW(), NOW()
    )
    RETURNING id INTO v_assessment_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Check whether the learner can match common analysis needs with the right Excel functions.',
        time_limit = 15,
        passing_score = 75,
        max_attempts = 3,
        is_active = TRUE,
        prerequisite_module_ids = ARRAY[v_module_3_id],
        display_order = 3,
        updated_at = NOW()
    WHERE id = v_assessment_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_id;

  INSERT INTO public.assessment_questions (assessment_id, question, question_type, options, correct_answer, points, "order", explanation, created_at)
  VALUES
    (v_assessment_id, 'When should SUMIFS be preferred over SUM?', 'multiple_choice', '["When the total must match one or more conditions", "When no numeric values exist", "When a chart title needs editing", "When removing duplicates only"]'::JSONB, 'When the total must match one or more conditions', 2, 1, 'SUMIFS adds conditional filtering to the summation process.', NOW()),
    (v_assessment_id, 'True or false: Absolute references help keep a fixed cell reference while formulas are copied.', 'true_false', NULL, 'true', 1, 2, 'Absolute references lock the referenced row, column, or both.', NOW()),
    (v_assessment_id, 'Which function is most appropriate for counting rows that meet a condition?', 'multiple_choice', '["COUNTIF", "CONCAT", "MID", "UPPER"]'::JSONB, 'COUNTIF', 2, 3, 'COUNTIF returns the number of values matching a criterion.', NOW());

  SELECT id INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'PivotTable and Chart Assessment'
  ORDER BY created_at
  LIMIT 1;

  IF v_assessment_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, prerequisite_module_ids, display_order, created_at, updated_at
    )
    VALUES (
      v_course_id, NULL, 'PivotTable and Chart Assessment', 'Assess the learner''s ability to choose useful summaries and visuals in Excel.', 15, 75, 3, TRUE, ARRAY[v_module_4_id], 4, NOW(), NOW()
    )
    RETURNING id INTO v_assessment_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Assess the learner''s ability to choose useful summaries and visuals in Excel.',
        time_limit = 15,
        passing_score = 75,
        max_attempts = 3,
        is_active = TRUE,
        prerequisite_module_ids = ARRAY[v_module_4_id],
        display_order = 4,
        updated_at = NOW()
    WHERE id = v_assessment_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_id;

  INSERT INTO public.assessment_questions (assessment_id, question, question_type, options, correct_answer, points, "order", explanation, created_at)
  VALUES
    (v_assessment_id, 'Why are PivotTables useful for reporting?', 'multiple_choice', '["They let the analyst reorganize and summarize data quickly", "They permanently delete source records", "They replace every formula in Excel", "They stop users from filtering data"]'::JSONB, 'They let the analyst reorganize and summarize data quickly', 2, 1, 'PivotTables make exploration and grouping faster without manual recalculation for every view.', NOW()),
    (v_assessment_id, 'True or false: Pie charts are always the best choice for showing trends over time.', 'true_false', NULL, 'false', 1, 2, 'Line charts usually communicate trends over time more clearly than pie charts.', NOW()),
    (v_assessment_id, 'Which visualization is usually strongest for comparing values across categories?', 'multiple_choice', '["Bar or column chart", "Freehand drawing", "Comment box", "Merged header row"]'::JSONB, 'Bar or column chart', 2, 3, 'Bar and column charts make category comparisons easier to read.', NOW());

  SELECT id INTO v_assessment_id
  FROM public.assessments
  WHERE course_id = v_course_id
    AND title = 'Excel Reporting Assessment'
  ORDER BY created_at
  LIMIT 1;

  IF v_assessment_id IS NULL THEN
    INSERT INTO public.assessments (
      course_id, module_id, title, description, time_limit, passing_score, max_attempts, is_active, prerequisite_module_ids, display_order, created_at, updated_at
    )
    VALUES (
      v_course_id, NULL, 'Excel Reporting Assessment', 'Evaluate whether the learner can frame an Excel analysis as a concise decision-support report.', 20, 80, 3, TRUE, ARRAY[v_module_5_id], 5, NOW(), NOW()
    )
    RETURNING id INTO v_assessment_id;
  ELSE
    UPDATE public.assessments
    SET module_id = NULL,
        description = 'Evaluate whether the learner can frame an Excel analysis as a concise decision-support report.',
        time_limit = 20,
        passing_score = 80,
        max_attempts = 3,
        is_active = TRUE,
        prerequisite_module_ids = ARRAY[v_module_5_id],
        display_order = 5,
        updated_at = NOW()
    WHERE id = v_assessment_id;
  END IF;

  DELETE FROM public.assessment_questions WHERE assessment_id = v_assessment_id;

  INSERT INTO public.assessment_questions (assessment_id, question, question_type, options, correct_answer, points, "order", explanation, created_at)
  VALUES
    (v_assessment_id, 'What is the strongest purpose of a report recommendation?', 'multiple_choice', '["To show what action the findings support", "To hide the analysis from stakeholders", "To replace all evidence with opinion", "To avoid summarizing the results"]'::JSONB, 'To show what action the findings support', 2, 1, 'A recommendation connects evidence to a decision or next step.', NOW()),
    (v_assessment_id, 'True or false: A report should be tailored to what the audience needs to know and act on.', 'true_false', NULL, 'true', 1, 2, 'Audience-aware reporting improves clarity and usefulness.', NOW()),
    (v_assessment_id, 'Which section helps explain the boundaries of what the analysis covered?', 'multiple_choice', '["Dataset scope", "Color palette", "Font choice", "File name only"]'::JSONB, 'Dataset scope', 2, 3, 'Scope clarifies what data and period the findings are based on.', NOW());

  RAISE NOTICE 'Seeded Excel modules and assessments for course: % (%)', v_course_title, v_course_id;
END $$;

COMMIT;