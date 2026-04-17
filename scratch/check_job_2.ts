import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const jobId = 'cmo1s3dfb0002uqy7g2eg5jlv'
  const job = await prisma.inspectionJob.findUnique({
    where: { id: jobId },
    include: {
      samples: {
        include: {
          sealLabel: true,
          media: true
        }
      }
    }
  })

  console.log(JSON.stringify(job, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
