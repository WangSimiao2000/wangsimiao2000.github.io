---
title: 光影集
icon: fas fa-camera-retro
order: 5
---

<style>
.gallery-card {
  overflow: hidden;
  cursor: pointer;
  border: none;
}
.gallery-card img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  transition: transform 0.3s ease;
}
.gallery-card:hover img {
  transform: scale(1.05);
}

/* 灯箱 */
.lb-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.92);
  justify-content: center;
  align-items: center;
}
.lb-overlay.active {
  display: flex;
}
.lb-overlay img {
  max-width: 92vw;
  max-height: 90vh;
  border-radius: 6px;
  object-fit: contain;
}
.lb-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.12);
  border: none;
  color: #fff;
  font-size: 2rem;
  padding: 10px 16px;
  cursor: pointer;
  border-radius: 6px;
}
.lb-btn:hover { background: rgba(255,255,255,0.25); }
.lb-prev { left: 16px; }
.lb-next { right: 16px; }
.lb-close {
  position: absolute;
  top: 14px;
  right: 18px;
  background: none;
  border: none;
  color: #fff;
  font-size: 2rem;
  cursor: pointer;
  opacity: 0.7;
}
.lb-close:hover { opacity: 1; }
.lb-counter {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.6);
  font-size: 0.9rem;
}
</style>

<!-- 灯箱 -->
<div class="lb-overlay" id="lightbox" role="dialog" aria-label="图片查看器">
  <button class="lb-close" aria-label="关闭" onclick="closeLB()">&times;</button>
  <button class="lb-btn lb-prev" aria-label="上一张" onclick="navLB(-1)">&#8249;</button>
  <img id="lb-img" alt="" />
  <button class="lb-btn lb-next" aria-label="下一张" onclick="navLB(1)">&#8250;</button>
  <div class="lb-counter" id="lb-counter"></div>
</div>

{% if site.data.gallery.size > 0 %}
<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3">
  {% for photo in site.data.gallery %}
    <div class="col">
      <div class="card gallery-card card-wrapper h-100" onclick="openLB({{ forloop.index0 }})">
        <img src="{{ photo.image }}" alt="{{ photo.title | default: '照片' }}" loading="lazy" />
      </div>
    </div>
  {% endfor %}
</div>
{% else %}
<p class="text-muted text-center mt-5">📷 还没有照片</p>
{% endif %}

<script>
(function() {
  var imgs = [
    {% for photo in site.data.gallery %}
      { src: "{{ photo.image }}", title: "{{ photo.title | default: '照片' }}" }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ];
  var idx = 0;
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbCtr = document.getElementById('lb-counter');

  function show() {
    lbImg.src = imgs[idx].src;
    lbImg.alt = imgs[idx].title;
    lbCtr.textContent = (idx + 1) + ' / ' + imgs.length;
  }
  window.openLB = function(i) {
    idx = i; show();
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  window.closeLB = function() {
    lb.classList.remove('active');
    document.body.style.overflow = '';
  };
  window.navLB = function(d) {
    event.stopPropagation();
    idx = (idx + d + imgs.length) % imgs.length;
    show();
  };
  lb.addEventListener('click', function(e) { if (e.target === lb) closeLB(); });
  document.addEventListener('keydown', function(e) {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') closeLB();
    if (e.key === 'ArrowLeft') navLB(-1);
    if (e.key === 'ArrowRight') navLB(1);
  });
})();
</script>
