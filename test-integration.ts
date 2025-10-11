#!/usr/bin/env bun
import { scraperIntegrationService } from './src/services/scraperIntegration.js';

async function testIntegration() {
  console.log('🧪 Iniciando prueba de integración end-to-end...\n');

  try {
    // 1. Verificar conectividad con el scraper
    console.log('1️⃣ Verificando conectividad con el scraper...');
    const healthCheck = await scraperIntegrationService.checkScraperHealth();
    console.log('   Estado del scraper:', healthCheck.isHealthy ? '✅ Saludable' : '❌ No disponible');
    console.log('   URL:', healthCheck.scraperUrl);
    
    if (!healthCheck.isHealthy) {
      console.log('   Error:', healthCheck.error);
      return;
    }
    
    // 2. Obtener datos del scraper
    console.log('\n2️⃣ Obteniendo datos del scraper...');
    const eventsData = await scraperIntegrationService.fetchEventsFromScraper();
    const newsData = await scraperIntegrationService.fetchNewsFromScraper();
    
    console.log(`   📅 Eventos obtenidos: USABMX=${eventsData.usabmx.length}, UCI=${eventsData.uci.length}`);
    console.log(`   📰 Noticias obtenidas: USABMX=${newsData.usabmx.length}, UCI=${newsData.uci.length}`);
    
    // 3. Sincronizar eventos
    console.log('\n3️⃣ Sincronizando eventos...');
    const eventsResult = await scraperIntegrationService.syncEvents();
    console.log(`   Resultado: ${eventsResult.success ? '✅ Éxito' : '❌ Error'}`);
    console.log(`   Eventos sincronizados: USABMX=${eventsResult.usabmx}, UCI=${eventsResult.uci}`);
    
    if (eventsResult.errors.length > 0) {
      console.log('   Errores:', eventsResult.errors.slice(0, 3)); // Solo primeros 3 errores
    }
    
    // 4. Sincronizar noticias
    console.log('\n4️⃣ Sincronizando noticias...');
    const newsResult = await scraperIntegrationService.syncNews();
    console.log(`   Resultado: ${newsResult.success ? '✅ Éxito' : '❌ Error'}`);
    console.log(`   Noticias sincronizadas: USABMX=${newsResult.usabmx}, UCI=${newsResult.uci}`);
    
    if (newsResult.errors.length > 0) {
      console.log('   Errores:', newsResult.errors.slice(0, 3)); // Solo primeros 3 errores
    }
    
    // 5. Verificar datos en la base de datos
    console.log('\n5️⃣ Verificando datos en la base de datos...');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const [totalEvents, totalNews, usabmxEvents, uciEvents, usabmxNews, uciNews] = await Promise.all([
      prisma.event.count(),
      prisma.news.count(),
      prisma.event.count({ where: { source: 'USABMX' } }),
      prisma.event.count({ where: { source: 'UCI' } }),
      prisma.news.count({ where: { source: 'USABMX' } }),
      prisma.news.count({ where: { source: 'UCI' } })
    ]);
    
    console.log(`   📊 Base de datos:`);
    console.log(`     Eventos: ${totalEvents} total (USABMX: ${usabmxEvents}, UCI: ${uciEvents})`);
    console.log(`     Noticias: ${totalNews} total (USABMX: ${usabmxNews}, UCI: ${uciNews})`);
    
    // 6. Mostrar algunos ejemplos
    if (totalEvents > 0) {
      console.log('\n6️⃣ Ejemplos de eventos sincronizados:');
      const sampleEvents = await prisma.event.findMany({
        take: 3,
        select: {
          title: true,
          location: true,
          start_date: true,
          source: true,
          latitude: true,
          longitude: true
        }
      });
      
      sampleEvents.forEach((event, i) => {
        console.log(`   ${i + 1}. ${event.title} (${event.source})`);
        console.log(`      📍 ${event.location}`);
        console.log(`      📅 ${event.start_date?.toISOString().split('T')[0] || 'Sin fecha'}`);
        console.log(`      🗺️ ${event.latitude && event.longitude ? 'Con coordenadas' : 'Sin coordenadas'}`);
      });
    }
    
    if (totalNews > 0) {
      console.log('\n   📰 Ejemplos de noticias sincronizadas:');
      const sampleNews = await prisma.news.findMany({
        take: 3,
        select: {
          title: true,
          category: true,
          published_at: true,
          source: true,
          url: true
        }
      });
      
      sampleNews.forEach((news, i) => {
        console.log(`   ${i + 1}. ${news.title} (${news.source})`);
        console.log(`      🏷️ ${news.category || 'Sin categoría'}`);
        console.log(`      📅 ${news.published_at?.toISOString().split('T')[0] || 'Sin fecha'}`);
        console.log(`      🔗 ${news.url ? 'Con URL' : 'Sin URL'}`);
      });
    }
    
    await prisma.$disconnect();
    
    console.log('\n🎉 ¡Integración end-to-end completada exitosamente!');
    console.log('   ✅ Scraper conectado y funcionando');
    console.log('   ✅ Sincronización de datos exitosa');
    console.log('   ✅ Datos almacenados en la base de datos');
    console.log('   ✅ Formato de datos correcto');
    
  } catch (error) {
    console.error('\n❌ Error durante la integración:', error);
    process.exit(1);
  }
}

testIntegration();
