---
title: 光影集
icon: fas fa-camera-retro
order: 5
---

<style>
/* 瀑布流容器 */
.gallery-grid {
  columns: 3;
  column-gap: 12px;
}
@media (max-width: 992px) {
  .gallery-grid { columns: 2; }
}
@media (max-width: 576px) {
  .gallery-grid { columns: 1; }
}

/* 图片卡片 */
.gallery-item {
  break-inside: avoid;
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  background: var(--card-bg, #f8f8f8);
}
.gallery-item img {
  width: 100%;
  display: block;
  transition: transform 0.3s ease, opacity 0.4s ease;
  opacity: 0;
}
.gallery-item img.loaded {
  opacity: 1;
}
.gallery-item:hover img {
  transform: scale(1.03);
}

/* 图片标题 */
.gallery-item .caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: linear-gradient(transparent, rgba(0,0,0,0.6));
  color: #fff;
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.gallery-item:hover .caption {
  opacity: 1;
}

/* 加载占位 */
.gallery-item .placeholder {
  padding-bottom: 66%;
  background: var(--card-bg, #eee);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}

/* 灯箱 */
.lightbox-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.92);
  justify-content: center;
  align-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.lightbox-overlay.active {
  display: flex;
  opacity: 1;
}
.lightbox-overlay img {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(0,0,0,0.5);
  object-fit: contain;
}
.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  font-size: 2rem;
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
  z-index: 10000;
}
.lightbox-nav:hover {
  background: rgba(255,255,255,0.3);
}
.lightbox-prev { left: 16px; }
.lightbox-next { right: 16px; }
.lightbox-close {
  position: absolute;
  top: 16px;
  right: 20px;
  background: none;
  border: none;
  color: #fff;
  font-size: 2rem;
  cursor: pointer;
  z-index: 10000;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.lightbox-close:hover { opacity: 1; }
.lightbox-counter {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.7);
  font-size: 0.9rem;
}

/* 空状态 */
.gallery-empty {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-muted-color, #999);
}
</style>

<!-- 灯箱 -->
<div class="lightbox-overlay" id="lightbox" role="dialog" aria-label="图片查看器">
  <button class="lightbox-close" aria-label="关闭" onclick="closeLightbox()">&times;</button>
  <button class="lightbox-nav lightbox-prev" aria-label="上一张" onclick="navLightbox(-1)">&#8249;</button>
  <img id="lightbox-img" alt="" />
  <button class="lightbox-nav lightbox-next" aria-label="下一张" onclick="navLightbox(1)">&#8250;</button>
  <div class="lightbox-counter" id="lightbox-counter"></div>
</div>

{% if site.data.gallery.size > 0 %}
<div class="gallery-grid" id="gallery-grid">
  {% for photo in site.data.gallery %}
    <div class="gallery-item" data-index="{{ forloop.index0 }}" onclick="openLightbox({{ forloop.index0 }})">
      <div class="placeholder"></div>
      <img src="{{ photo.image }}" alt="{{ photo.title | default: '照片' }}" loading="lazy" onload="this.classList.add('loaded');this.previousElementSibling.style.display='none';" />
      {% if photo.title %}
        <div class="caption">{{ photo.title }}</div>
      {% endif %}
    </div>
  {% endfor %}
</div>
{% else %}
<div class="gallery-empty">
  <p style="font-size:3rem;margin-bottom:0.5rem;">📷</p>
  <p>还没有照片</p>
  <p style="font-size:0.85rem;">配置 R2 图床后运行 <code>scripts/generate-gallery-r2.sh</code> 生成相册</p>
</div>
{% endif %}

<script>
(function() {
  const images = [
    {% for photo in site.data.gallery %}
      { src: "{{ photo.image }}", title: "{{ photo.title | default: '照片' }}" }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ];

  let currentIndex = 0;
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');

  window.openLightbox = function(index) {
    currentIndex = index;
    showImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeLightbox = function() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.navLightbox = function(dir) {
    event.stopPropagation();
    currentIndex = (currentIndex + dir + images.length) % images.length;
    showImage();
  };

  function showImage() {
    if (!images.length) return;
    lightboxImg.src = images[currentIndex].src;
    lightboxImg.alt = images[currentIndex].title;
    counter.textContent = (currentIndex + 1) + ' / ' + images.length;
  }

  // 点击背景关闭
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });

  // 键盘导航
  document.addEventListener('keydown', function(e) {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  });
})();
</script>
