import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sampleId = 'cmo1samu6003cuq8k31yt8wqp'
  const jobId = 'cmo1s3dfb0002uqy7g2eg5jlv'

  console.log('Seeding seal evidence for sample:', sampleId)

  await prisma.$transaction(async (tx) => {
    // 1. Create or Update Seal Label
    await tx.sampleSealLabel.upsert({
      where: { sampleId },
      create: {
        sampleId,
        sealNo: 'SL-2026-0002',
        sealedAt: new Date(),
        labelText: 'SAMPLE-SEAL-0002',
        sealStatus: 'SEALED',
        sealSource: 'MANUAL_SEED',
      },
      update: {
        sealNo: 'SL-2026-0002',
        sealedAt: new Date(),
        sealStatus: 'SEALED',
      }
    })

    // 2. Create Sealed Sample Media
    await tx.sampleMedia.create({
      data: {
        sampleId,
        mediaType: 'SEALED_SAMPLE',
        fileUrl: '/uploads/f501bc59-c61c-4b4b-8967-e47d3bfbb508-WhatsApp_Image_2026-04-13_at_19.01.54.jpeg',
        capturedAt: new Date(),
        capturedById: 'superadmin_1775803470560',
        remarks: 'Seeded seal photo',
      }
    })

    console.log('Seal evidence seeded successfully.')
  })
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
