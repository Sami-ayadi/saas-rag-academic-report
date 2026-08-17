import { db } from '@/lib/db';
import { generateFrenchSummary, generateFrenchReportSections } from '@/lib/types';

const DEMO_USER_EMAIL = 'demo@rapportgen.fr';
const DEMO_USER_NAME = 'Étudiant Démo';
const DEMO_USER_ID = 'demo-user-001';
const DEMO_ADMIN_ID = 'demo-admin-001';

const DEMO_PROJECTS = [
  {
    id: 'proj-001',
    title: 'IA et Diagnostic Médical',
    brief: 'Étude sur l\'application de l\'intelligence artificielle dans le diagnostic médical assisté par ordinateur. Ce projet vise à développer un modèle de deep learning pour la détection précoce de pathologies à partir d\'images médicales.',
    academicLevel: 'Master',
    university: 'Université de Bordeaux',
    field: 'Intelligence Artificielle',
    language: 'fr',
    status: 'REPORT_READY' as const,
  },
  {
    id: 'proj-002',
    title: 'Blockchain pour la Supply Chain',
    brief: 'Analyse des solutions blockchain pour la traçabilité et la transparence dans la chaîne d\'approvisionnement pharmaceutique.',
    academicLevel: 'Master',
    university: 'École Centrale Lyon',
    field: 'Blockchain & Sécurité',
    language: 'fr',
    status: 'SUMMARY_READY' as const,
  },
  {
    id: 'proj-003',
    title: 'IoT Agriculture Intelligente',
    brief: 'Conception d\'un système IoT pour l\'agriculture de précision, intégrant des capteurs environnementaux et des algorithmes d\'optimisation.',
    academicLevel: 'Master',
    university: 'INSA Toulouse',
    field: 'Internet des Objets',
    language: 'fr',
    status: 'DRAFT' as const,
  },
  {
    id: 'proj-004',
    title: 'Cybersécurité des Infrastructures Critiques',
    brief: 'Évaluation des vulnérabilités et proposition de mécanismes de défense pour les systèmes SCADA des infrastructures énergétiques.',
    academicLevel: 'Master',
    university: 'UTC Compiègne',
    field: 'Cybersécurité',
    language: 'fr',
    status: 'GENERATING' as const,
  },
];

const DEMO_DOCUMENTS = [
  {
    id: 'doc-001',
    projectId: 'proj-001',
    filename: 'ml_healthcare_review.pdf',
    originalName: 'ML in Healthcare - A Systematic Review.pdf',
    mimeType: 'application/pdf',
    size: 2548000,
    storageKey: 'documents/proj-001/ml_healthcare_review.pdf',
    status: 'processed',
    chunkCount: 42,
  },
  {
    id: 'doc-002',
    projectId: 'proj-001',
    filename: 'deep_learning_imaging.pdf',
    originalName: 'Deep Learning for Medical Imaging - Survey.pdf',
    mimeType: 'application/pdf',
    size: 3120000,
    storageKey: 'documents/proj-001/deep_learning_imaging.pdf',
    status: 'processed',
    chunkCount: 56,
  },
  {
    id: 'doc-003',
    projectId: 'proj-001',
    filename: 'clinical_ai_ethics.pdf',
    originalName: 'Ethical Considerations in Clinical AI.pdf',
    mimeType: 'application/pdf',
    size: 890000,
    storageKey: 'documents/proj-001/clinical_ai_ethics.pdf',
    status: 'processed',
    chunkCount: 18,
  },
  {
    id: 'doc-004',
    projectId: 'proj-002',
    filename: 'blockchain_pharma.pdf',
    originalName: 'Blockchain in Pharmaceutical Supply Chain.pdf',
    mimeType: 'application/pdf',
    size: 1876000,
    storageKey: 'documents/proj-002/blockchain_pharma.pdf',
    status: 'processed',
    chunkCount: 34,
  },
  {
    id: 'doc-005',
    projectId: 'proj-002',
    filename: 'smart_contracts_traceability.pdf',
    originalName: 'Smart Contracts for Product Traceability.pdf',
    mimeType: 'application/pdf',
    size: 1450000,
    storageKey: 'documents/proj-002/smart_contracts_traceability.pdf',
    status: 'processed',
    chunkCount: 28,
  },
  {
    id: 'doc-006',
    projectId: 'proj-003',
    filename: 'iot_precision_agriculture.pdf',
    originalName: 'IoT for Precision Agriculture - Review.pdf',
    mimeType: 'application/pdf',
    size: 2200000,
    storageKey: 'documents/proj-003/iot_precision_agriculture.pdf',
    status: 'uploaded',
    chunkCount: 0,
  },
  {
    id: 'doc-007',
    projectId: 'proj-004',
    filename: 'scada_security.pdf',
    originalName: 'SCADA Systems Security Assessment.pdf',
    mimeType: 'application/pdf',
    size: 3100000,
    storageKey: 'documents/proj-004/scada_security.pdf',
    status: 'processed',
    chunkCount: 52,
  },
  {
    id: 'doc-008',
    projectId: 'proj-004',
    filename: 'critical_infra_protection.pdf',
    originalName: 'Critical Infrastructure Protection Framework.pdf',
    mimeType: 'application/pdf',
    size: 1760000,
    storageKey: 'documents/proj-004/critical_infra_protection.pdf',
    status: 'processed',
    chunkCount: 31,
  },
];

export async function seedDatabase() {
  // Clean existing data (in reverse dependency order)
  await db.adminAuditLog.deleteMany();
  await db.apiUsageMonthly.deleteMany();
  await db.apiUsage.deleteMany();
  await db.embedding.deleteMany();
  await db.generationJob.deleteMany();
  await db.report.deleteMany();
  await db.summary.deleteMany();
  await db.document.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();

  // Create demo user
  const user = await db.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      image: null,
      tier: 'PRO',
      role: 'USER',
      isActive: true,
      creditsUsed: 7,
      creditsLimit: 50,
    },
  });

  await db.user.create({
    data: {
      id: DEMO_ADMIN_ID,
      email: 'admin.demo@rapportgen.fr',
      name: 'Administrateur Démo',
      image: null,
      tier: 'PRO',
      role: 'ADMIN',
      isActive: true,
      creditsUsed: 0,
      creditsLimit: 999,
    },
  });

  // Create projects
  for (const proj of DEMO_PROJECTS) {
    await db.project.create({
      data: {
        ...proj,
        userId: user.id,
      },
    });
  }

  // Create documents
  for (const doc of DEMO_DOCUMENTS) {
    await db.document.create({ data: doc });
  }

  // Create summary for proj-001 (REPORT_READY)
  const summaryContent1 = generateFrenchSummary("L'intelligence artificielle dans la santé");
  const summary1 = await db.summary.create({
    data: {
      id: 'summ-001',
      projectId: 'proj-001',
      version: 2,
      content: summaryContent1,
      structure: JSON.stringify({
        title: "L'IA dans la santé",
        keyPoints: ['Deep learning', 'Diagnostic assisté', 'Imagerie médicale'],
        methodology: 'Revue systématique et expérimentations',
        findings: ['Amélioration de 35% de la précision', 'Réduction des faux positifs'],
        gaps: ['Interprétabilité des modèles', 'Validation clinique'],
      }),
      status: 'SUMMARY_READY',
    },
  });

  // Create report for proj-001 (REPORT_READY)
  const reportSections1 = generateFrenchReportSections("L'intelligence artificielle dans la santé");
  const fullContent = reportSections1.map(s => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
  const wordCount = fullContent.split(/\s+/).filter(Boolean).length;

  await db.report.create({
    data: {
      id: 'rpt-001',
      projectId: 'proj-001',
      summaryId: summary1.id,
      title: 'Rapport de Stage : IA et Diagnostic Médical',
      content: fullContent,
      sections: JSON.stringify(reportSections1),
      status: 'REPORT_READY',
      wordCount,
    },
  });

  // Create completed generation job for proj-001 summary
  await db.generationJob.create({
    data: {
      id: 'job-001',
      userId: user.id,
      projectId: 'proj-001',
      type: 'summary',
      status: 'COMPLETED',
      progress: 100,
      progressMessage: 'Synthèse générée avec succès',
      outputData: JSON.stringify({ summaryId: 'summ-001' }),
      startedAt: new Date(Date.now() - 86400000 * 3),
      completedAt: new Date(Date.now() - 86400000 * 3),
    },
  });

  // Create completed generation job for proj-001 report
  await db.generationJob.create({
    data: {
      id: 'job-002',
      userId: user.id,
      projectId: 'proj-001',
      type: 'report',
      status: 'COMPLETED',
      progress: 100,
      progressMessage: 'Rapport généré avec succès',
      outputData: JSON.stringify({ reportId: 'rpt-001' }),
      startedAt: new Date(Date.now() - 86400000 * 2),
      completedAt: new Date(Date.now() - 86400000 * 2),
    },
  });

  // Create summary for proj-002 (SUMMARY_READY)
  const summaryContent2 = generateFrenchSummary('La blockchain et la finance décentralisée');
  await db.summary.create({
    data: {
      id: 'summ-002',
      projectId: 'proj-002',
      version: 1,
      content: summaryContent2,
      structure: JSON.stringify({
        title: 'Blockchain & Supply Chain',
        keyPoints: ['Traçabilité', 'Smart contracts', 'Transparence'],
        methodology: 'Analyse comparative et modélisation',
        findings: ['Réduction des fraudes de 60%', 'Amélioration de la traçabilité'],
        gaps: ['Interopérabilité', 'Réglementation'],
      }),
      status: 'SUMMARY_READY',
    },
  });

  // Create completed job for proj-002 summary
  await db.generationJob.create({
    data: {
      id: 'job-003',
      userId: user.id,
      projectId: 'proj-002',
      type: 'summary',
      status: 'COMPLETED',
      progress: 100,
      progressMessage: 'Synthèse générée avec succès',
      outputData: JSON.stringify({ summaryId: 'summ-002' }),
      startedAt: new Date(Date.now() - 86400000),
      completedAt: new Date(Date.now() - 86400000),
    },
  });

  // Create active generation job for proj-004 (GENERATING)
  await db.generationJob.create({
    data: {
      id: 'job-004',
      userId: user.id,
      projectId: 'proj-004',
      type: 'report',
      status: 'PROCESSING',
      progress: 65,
      progressMessage: 'Génération du chapitre 3 en cours...',
      startedAt: new Date(Date.now() - 3600000),
    },
  });

  // Create API usage records
  await db.apiUsage.createMany({
    data: [
      {
        userId: user.id,
        projectId: 'proj-001',
        type: 'summary_generation',
        inputTokens: 12500,
        outputTokens: 3200,
        costUsd: 0.08,
      },
      {
        userId: user.id,
        projectId: 'proj-001',
        type: 'report_generation',
        inputTokens: 28000,
        outputTokens: 8900,
        costUsd: 0.22,
      },
      {
        userId: user.id,
        projectId: 'proj-002',
        type: 'summary_generation',
        inputTokens: 10200,
        outputTokens: 2800,
        costUsd: 0.06,
      },
      {
        userId: user.id,
        projectId: 'proj-004',
        type: 'report_generation',
        inputTokens: 15000,
        outputTokens: 4500,
        costUsd: 0.14,
      },
    ],
  });

  await db.adminAuditLog.createMany({
    data: [
      {
        actorId: DEMO_ADMIN_ID,
        action: 'PLATFORM_REVIEW',
        targetType: 'SYSTEM',
        targetLabel: 'Plateforme',
        summary: 'Vérification quotidienne de la plateforme terminée',
        metadata: { source: 'seed' },
        createdAt: new Date(Date.now() - 1000 * 60 * 42),
      },
      {
        actorId: DEMO_ADMIN_ID,
        action: 'USER_TIER_UPDATED',
        targetType: 'USER',
        targetId: DEMO_USER_ID,
        targetLabel: DEMO_USER_NAME,
        summary: 'Plan utilisateur passé à Pro',
        metadata: { before: { tier: 'STARTER' }, after: { tier: 'PRO' } },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
      },
    ],
  });

  return {
    userId: user.id,
    projectsCreated: DEMO_PROJECTS.length,
    documentsCreated: DEMO_DOCUMENTS.length,
    reportsCreated: 1,
    summariesCreated: 2,
  };
}
