import { db } from '@/lib/db'

export async function seedDatabase() {
  console.log('🌱 Seeding database...')

  // Check if data already exists
  const existingUsers = await db.user.count()
  if (existingUsers > 0) {
    console.log('📦 Database already seeded, skipping.')
    return
  }

  // Create demo users
  const userFree = await db.user.create({
    data: {
      email: 'marie.dupont@universite.fr',
      name: 'Marie Dupont',
      image: null,
      tier: 'FREE',
      creditsUsed: 1,
      creditsLimit: 3,
    },
  })

  const userPro = await db.user.create({
    data: {
      email: 'jean.martin@research.fr',
      name: 'Jean Martin',
      image: null,
      tier: 'PRO',
      creditsUsed: 12,
      creditsLimit: 999,
    },
  })

  // Create demo projects for FREE user
  const project1 = await db.project.create({
    data: {
      userId: userFree.id,
      title: 'Analyse des politiques climatiques en Europe',
      brief: 'Étude comparative des politiques climatiques adoptées par les pays membres de l\'Union européenne entre 2015 et 2024.',
      academicLevel: 'Master',
      university: 'Université de Paris',
      field: 'Sciences Politiques',
      status: 'REPORT_READY',
      language: 'fr',
    },
  })

  const project2 = await db.project.create({
    data: {
      userId: userFree.id,
      title: 'Intelligence artificielle et éducation',
      brief: 'Impact de l\'IA générative sur les méthodes d\'enseignement supérieur en France.',
      academicLevel: 'Master',
      university: 'Université de Lyon',
      field: 'Sciences de l\'Éducation',
      status: 'SUMMARY_READY',
      language: 'fr',
    },
  })

  // Create demo projects for PRO user
  const project3 = await db.project.create({
    data: {
      userId: userPro.id,
      title: 'Nanotechnologies et médecine régénérative',
      brief: 'Revue systématique des applications des nanomatériaux dans la régénération tissulaire et osseuse.',
      academicLevel: 'Doctorat',
      university: 'École Polytechnique Fédérale',
      field: 'Nanotechnologie',
      status: 'GENERATING',
      language: 'fr',
    },
  })

  // Create documents for project 1
  await db.document.createMany({
    data: [
      {
        projectId: project1.id,
        filename: 'policy_doc_1.pdf',
        originalName: 'EU_Climate_Policy_2015-2020.pdf',
        mimeType: 'application/pdf',
        size: 2_450_000,
        storageKey: 'projects/p1/doc1.pdf',
        status: 'processed',
        chunkCount: 42,
      },
      {
        projectId: project1.id,
        filename: 'policy_doc_2.pdf',
        originalName: 'Green_Deal_Analysis.pdf',
        mimeType: 'application/pdf',
        size: 1_890_000,
        storageKey: 'projects/p1/doc2.pdf',
        status: 'processed',
        chunkCount: 31,
      },
      {
        projectId: project1.id,
        filename: 'policy_doc_3.pdf',
        originalName: 'Carbon_Neutral_2050_Report.pdf',
        mimeType: 'application/pdf',
        size: 3_200_000,
        storageKey: 'projects/p1/doc3.pdf',
        status: 'processed',
        chunkCount: 55,
      },
    ],
  })

  // Create documents for project 2
  await db.document.createMany({
    data: [
      {
        projectId: project2.id,
        filename: 'ai_education_1.pdf',
        originalName: 'AI_in_Higher_Education_2023.pdf',
        mimeType: 'application/pdf',
        size: 1_500_000,
        storageKey: 'projects/p2/doc1.pdf',
        status: 'processed',
        chunkCount: 28,
      },
      {
        projectId: project2.id,
        filename: 'ai_education_2.pdf',
        originalName: 'Generative_AI_Classroom_Impact.pdf',
        mimeType: 'application/pdf',
        size: 980_000,
        storageKey: 'projects/p2/doc2.pdf',
        status: 'processed',
        chunkCount: 18,
      },
    ],
  })

  // Create documents for project 3
  await db.document.createMany({
    data: [
      {
        projectId: project3.id,
        filename: 'nano_med_1.pdf',
        originalName: 'Nanomaterials_Tissue_Engineering.pdf',
        mimeType: 'application/pdf',
        size: 4_500_000,
        storageKey: 'projects/p3/doc1.pdf',
        status: 'processed',
        chunkCount: 67,
      },
      {
        projectId: project3.id,
        filename: 'nano_med_2.pdf',
        originalName: 'Bone_Regeneration_Nano.pdf',
        mimeType: 'application/pdf',
        size: 3_100_000,
        storageKey: 'projects/p3/doc2.pdf',
        status: 'processing',
        chunkCount: 0,
      },
    ],
  })

  // Create summaries
  const summary1 = await db.summary.create({
    data: {
      projectId: project1.id,
      version: 2,
      content: 'Résumé synthétique des politiques climatiques européennes analysées dans les documents fournis...',
      structure: JSON.stringify([
        { title: 'Introduction', description: 'Contexte et objectifs de l\'étude', order: 1 },
        { title: 'Cadre réglementaire européen', description: 'Directives et réglementations clés', order: 2 },
        { title: 'Analyse comparative par pays', description: 'Comparaison des stratégies nationales', order: 3 },
        { title: 'Impact et résultats', description: 'Bilan des mesures adoptées', order: 4 },
        { title: 'Perspectives et recommandations', description: 'Voies d\'amélioration futures', order: 5 },
      ]),
      status: 'SUMMARY_READY',
    },
  })

  await db.summary.create({
    data: {
      projectId: project2.id,
      version: 1,
      content: 'Résumé de l\'impact de l\'intelligence artificielle générative sur l\'éducation...',
      structure: JSON.stringify([
        { title: 'Introduction', description: 'État de l\'art de l\'IA en éducation', order: 1 },
        { title: 'Méthodologie', description: 'Approche de la revue de littérature', order: 2 },
        { title: 'Résultats principaux', description: 'Constats majeurs de l\'analyse', order: 3 },
        { title: 'Discussion', description: 'Interprétation et implications', order: 4 },
      ]),
      status: 'SUMMARY_READY',
    },
  })

  // Create reports
  await db.report.create({
    data: {
      projectId: project1.id,
      summaryId: summary1.id,
      title: 'Analyse des politiques climatiques en Europe (2015-2024)',
      content: 'Rapport académique complet sur l\'analyse comparative...',
      sections: JSON.stringify([
        { id: 's1', title: 'Introduction', content: 'Le changement climatique...', order: 1 },
        { id: 's2', title: 'Cadre réglementaire', content: 'L\'Union européenne a adopté...', order: 2 },
        { id: 's3', title: 'Analyse comparative', content: 'Notre analyse comparative révèle...', order: 3 },
        { id: 's4', title: 'Impact et résultats', content: 'Les résultats montrent que...', order: 4 },
        { id: 's5', title: 'Recommandations', content: 'Sur la base de nos conclusions...', order: 5 },
      ]),
      status: 'REPORT_READY',
      wordCount: 8450,
    },
  })

  // Create generation jobs
  await db.generationJob.create({
    data: {
      userId: userFree.id,
      projectId: project1.id,
      type: 'summary',
      status: 'COMPLETED',
      progress: 100,
      progressMessage: 'Résumé généré avec succès',
      startedAt: new Date('2024-12-01T10:00:00'),
      completedAt: new Date('2024-12-01T10:15:00'),
    },
  })

  await db.generationJob.create({
    data: {
      userId: userPro.id,
      projectId: project3.id,
      type: 'report',
      status: 'PROCESSING',
      progress: 45,
      progressMessage: 'Rédaction de la section 3 sur les biomatériaux...',
      startedAt: new Date('2024-12-02T14:00:00'),
    },
  })

  // Create API usage records
  await db.apiUsage.createMany({
    data: [
      {
        userId: userFree.id,
        projectId: project1.id,
        type: 'summary_generation',
        inputTokens: 12500,
        outputTokens: 3200,
        costUsd: 0.12,
      },
      {
        userId: userFree.id,
        projectId: project1.id,
        type: 'report_generation',
        inputTokens: 18500,
        outputTokens: 8500,
        costUsd: 0.35,
      },
      {
        userId: userPro.id,
        projectId: project3.id,
        type: 'summary_generation',
        inputTokens: 22000,
        outputTokens: 5500,
        costUsd: 0.28,
      },
      {
        userId: userPro.id,
        projectId: project3.id,
        type: 'report_generation',
        inputTokens: 15000,
        outputTokens: 4200,
        costUsd: 0.22,
      },
    ],
  })

  console.log('✅ Database seeded successfully!')
  console.log(`   - 2 users created (${userFree.email}, ${userPro.email})`)
  console.log(`   - 3 projects created`)
  console.log(`   - 7 documents created`)
  console.log(`   - 2 summaries created`)
  console.log(`   - 1 report created`)
  console.log(`   - 2 generation jobs created`)
  console.log(`   - 4 API usage records created`)
}
