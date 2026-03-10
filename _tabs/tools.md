---
title: 小工具
icon: fas fa-toolbox
order: 6
---

<style>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.tool-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border-color);
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.default-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 1.5rem;
  color: var(--text-color);
  opacity: 0.6;
}

.card-text h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.card-text p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.75;
}
</style>

<div class="card-grid">
  {% for tool in site.data.tools %}
    {% if tool.name and tool.url %}
      <a href="{{ tool.url }}" class="tool-card">
        <div class="card-icon">
          {% if tool.icon %}
            <span class="default-icon"><i class="{{ tool.icon }}"></i></span>
          {% else %}
            <span class="default-icon"><i class="fas fa-puzzle-piece"></i></span>
          {% endif %}
        </div>
        <div class="card-text">
          <h3>{{ tool.name }}</h3>
          {% if tool.description %}
            <p>{{ tool.description }}</p>
          {% endif %}
        </div>
      </a>
    {% endif %}
  {% endfor %}
</div>
