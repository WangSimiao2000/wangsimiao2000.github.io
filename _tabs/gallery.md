---
title: 光影集
icon: fas fa-camera-retro
order: 5
---

<style>
.gallery-grid {
  columns: 3;
  column-gap: 12px;
}
@media (max-width: 768px) {
  .gallery-grid { columns: 2; }
}
@media (max-width: 480px) {
  .gallery-grid { columns: 1; }
}
.gallery-item {
  break-inside: avoid;
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}
.gallery-item img {
  width: 100%;
  display: block;
  transition: transform 0.3s ease;
}
.gallery-item:hover img {
  transform: scale(1.03);
}
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
</style>

<!-- 灯箱 -->
<div id="lightbox" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);justify-content:center;align-items:center;cursor:pointer;" onclick="this.style.display='none'">
  <img id="lightbox-img" style="max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 0 30px rgba(0,0,0,0.5);" />
</div>

{% if site.data.gallery.size > 0 %}
<div class="gallery-grid">
  {% for photo in site.data.gallery %}
    <div class="gallery-item" onclick="document.getElementById('lightbox-img').src='{{ photo.image }}';document.getElementById('lightbox').style.display='flex';">
      <img src="{{ photo.image }}" alt="{{ photo.title | default: '照片' }}" loading="lazy" />
      {% if photo.title %}
        <div class="caption">{{ photo.title }}</div>
      {% endif %}
    </div>
  {% endfor %}
</div>
{% else %}
<p class="text-muted text-center mt-5">📷 还没有照片，快往 <code>assets/img/gallery/</code> 里放几张吧</p>
{% endif %}
