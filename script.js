// ===== API КЛЮЧИ =====
const CONFIG = {
  // Google Custom Search API (получить в Google Cloud Console)
  googleApiKey: 'ЗАМЕНИТЕ_НА_ВАШ_API_КЛЮЧ',   // если нет — оставьте как есть
  googleCx: 'f62971ee9c51b4fb9',              // ваш идентификатор (уже вставлен)
  // Abstract Phone Validation (бесплатно 100 запросов/мес)
  abstractApiKey: 'ваш_ключ_abstract'          // опционально
};

// ===== ОСНОВНАЯ ФУНКЦИЯ ПОИСКА =====
async function globalSearch(query) {
  const results = [];
  const q = query.trim();

  const phoneMatch = q.match(/^(\+7|8)?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/);
  const emailMatch = q.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const nameMatch = q.length > 2 && !phoneMatch && !emailMatch;

  if (phoneMatch) {
    const phoneInfo = await checkPhone(q);
    if (phoneInfo) results.push(phoneInfo);
  }

  if (emailMatch) {
    const googleResults = await googleSearch(q);
    results.push({
      type: 'email',
      value: q,
      source: 'Google Search',
      links: googleResults,
      score: 100
    });
  }

  if (nameMatch || (q.length > 1 && !phoneMatch && !emailMatch)) {
    const googleLinks = await googleSearch(q);
    const socialLinks = generateSocialLinks(q);
    results.push({
      type: 'person',
      query: q,
      source: 'Google + соцсети',
      links: [...googleLinks, ...socialLinks],
      score: 90
    });
  }

  return results;
}

// ===== ПРОВЕРКА ТЕЛЕФОНА ЧЕРЕЗ ABSTRACT API =====
async function checkPhone(phone) {
  if (!CONFIG.abstractApiKey || CONFIG.abstractApiKey === 'ваш_ключ_abstract') return null;
  const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${CONFIG.abstractApiKey}&phone=${encodeURIComponent(phone)}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.valid) return null;
    return {
      type: 'phone',
      value: phone,
      country: data.country || '—',
      operator: data.carrier || '—',
      location: data.location || '—',
      score: 95,
      raw: data
    };
  } catch {
    return null;
  }
}

// ===== ПОИСК В GOOGLE CUSTOM SEARCH =====
async function googleSearch(query) {
  // Если нет API-ключа — возвращаем фолбэк (прямые ссылки на поиск)
  if (!CONFIG.googleApiKey || CONFIG.googleApiKey === 'ЗАМЕНИТЕ_НА_ВАШ_API_КЛЮЧ' || !CONFIG.googleCx) {
    return generateGoogleFallback(query);
  }
  const url = `https://www.googleapis.com/customsearch/v1?key=${CONFIG.googleApiKey}&cx=${CONFIG.googleCx}&q=${encodeURIComponent(query)}&num=5`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (data.items) {
      return data.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      }));
    }
    return [];
  } catch {
    return generateGoogleFallback(query);
  }
}

// ===== ФОЛБЭК ЕСЛИ НЕТ КЛЮЧА =====
function generateGoogleFallback(query) {
  const cx = CONFIG.googleCx || '';
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}` + (cx ? `&cx=${cx}` : '');
  return [
    { title: 'Поиск в Google', link: googleSearchUrl, snippet: 'Перейдите по ссылке для просмотра результатов' },
    { title: 'Поиск в Яндекс', link: `https://yandex.ru/search/?text=${encodeURIComponent(query)}`, snippet: '' }
  ];
}

// ===== ГЕНЕРАЦИЯ ССЫЛОК НА СОЦСЕТИ =====
function generateSocialLinks(query) {
  const encoded = encodeURIComponent(query);
  return [
    { title: 'ВКонтакте', link: `https://vk.com/search?c%5Bq%5D=${encoded}&c%5Bsection%5D=people`, snippet: '' },
    { title: 'Одноклассники', link: `https://ok.ru/search?st.type=users&st.query=${encoded}`, snippet: '' },
    { title: 'Facebook', link: `https://www.facebook.com/search/people/?q=${encoded}`, snippet: '' },
    { title: 'Instagram', link: `https://www.google.com/search?q=${encoded}+site:instagram.com`, snippet: '' },
    { title: 'Telegram', link: `https://t.me/s/${encoded}`, snippet: '' }
  ];
}

// ===== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ =====
function displayResults(results) {
  const container = document.getElementById('results');
  container.innerHTML = '';
  if (!results || results.length === 0) {
    container.innerHTML = `<p style="color:#8b949e;">Ничего не найдено. Попробуйте другой запрос.</p>`;
    return;
  }
  results.forEach((res, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    let html = `<h3>${idx+1}. ${res.type === 'phone' ? '📱 Телефон' : res.type === 'email' ? '📧 Email' : '👤 Личность'}</h3>`;
    if (res.value) html += `<div class="field"><strong>Запрос:</strong> ${res.value}</div>`;
    if (res.country) html += `<div class="field"><strong>Страна:</strong> ${res.country}</div>`;
    if (res.operator) html += `<div class="field"><strong>Оператор:</strong> ${res.operator}</div>`;
    if (res.location) html += `<div class="field"><strong>Регион:</strong> ${res.location}</div>`;
    if (res.links && res.links.length) {
      html += `<div class="field"><strong>Найдено ссылок:</strong> ${res.links.length}</div>`;
      res.links.slice(0, 10).forEach(link => {
        html += `<div class="field"><a href="${link.link}" target="_blank" class="link">${link.title || link.link}</a>`;
        if (link.snippet) html += ` — ${link.snippet}`;
        html += `</div>`;
      });
    }
    html += `<div class="score">🎯 Релевантность: ${res.score || 70}% (оценка)</div>`;
    card.innerHTML = html;
    container.appendChild(card);
  });
}

// ===== ОБРАБОТЧИК ПОИСКА =====
async function handleSearch() {
  const input = document.getElementById('searchInput');
  const query = input.value.trim();
  if (!query) {
    document.getElementById('status').textContent = '⚠️ Введите данные для поиска';
    document.getElementById('results').innerHTML = '';
    return;
  }
  document.getElementById('status').textContent = '⏳ Поиск...';
  try {
    const results = await globalSearch(query);
    document.getElementById('status').textContent = `✅ Найдено результатов: ${results.length}`;
    displayResults(results);
  } catch (err) {
    document.getElementById('status').textContent = '❌ Ошибка: ' + err.message;
  }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('searchBtn').addEventListener('click', handleSearch);
  document.getElementById('searchInput').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
});