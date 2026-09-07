function showAbout() {
  document.getElementById("aboutBox").style.display = "block";
}
function hideAbout() {
  document.getElementById("aboutBox").style.display = "none";
}

let searchValue = "";
let categoryFilter = "";
let lastVisible = null;
let isDetailView = false;
let lastScrollPostId = null;
const POSTS_CACHE_KEY = "realPeskyPostsCache";
const POSTS_CACHE_TTL = 1000 * 60 * 30;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPostUrl(postId) {
  const url = new URL(window.location.href);
  url.searchParams.set("post", postId);
  return url.pathname + url.search;
}

function openPostDetail(postId) {
  const url = new URL(window.location.href);
  url.searchParams.set("post", postId);
  window.history.pushState({}, "", url);
  showPostDetail(postId);
}

function closePostDetail() {
  const url = new URL(window.location.href);
  url.searchParams.delete("post");
  window.history.pushState({}, "", url);
  isDetailView = false;
  loadPosts();
}

function copyPostLink(postId) {
  const link = `${window.location.origin}${getPostUrl(postId)}`;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      alert("Post link copied. You can share this unique article URL.");
    })
    .catch(() => {
      alert("Copy failed. You can copy this URL manually: " + link);
    });
}

function formatPostSummary(text) {
  if (!text) return "";
  return text.length > 180 ? text.substring(0, 180) + "..." : text;
}

function formatPostDate(value) {
  if (!value) return "";

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  if (value && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function getCachedPosts() {
  try {
    const raw = localStorage.getItem(POSTS_CACHE_KEY);
    if (!raw) return [];

    const cache = JSON.parse(raw);
    if (!cache || !Array.isArray(cache.posts) || !cache.savedAt) return [];

    const isFresh = Date.now() - cache.savedAt < POSTS_CACHE_TTL;
    if (!isFresh) return [];

    return cache.posts.map((item) => ({
      id: item.id,
      data: () => item.data,
    }));
  } catch (error) {
    return [];
  }
}

function savePostsToCache(docs) {
  try {
    const posts = docs.map((doc) => {
      const data = doc.data();
      const safeData = { ...data };

      if (safeData.time && typeof safeData.time.toDate === "function") {
        safeData.time = safeData.time.toDate().toISOString();
      }

      return {
        id: doc.id,
        data: safeData,
      };
    });

    localStorage.setItem(
      POSTS_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        posts,
      })
    );
  } catch (error) {
    // Ignore cache write errors to keep page usable.
  }
}

function renderCachedPosts() {
  const cachedPosts = getCachedPosts();
  if (!cachedPosts.length) {
    const postsContainer = document.getElementById("posts");
    if (postsContainer) {
      postsContainer.innerHTML = '<div class="loading-state">Loading latest posts...</div>';
    }
    return false;
  }

  renderFeed(cachedPosts);
  return true;
}

function buildPostCard(post, postId) {
  const postDate = formatPostDate(post.time);
  const author = post.author || "realpesky";
  const title = escapeHtml(post.title || "");
  const summary = escapeHtml(formatPostSummary(post.description || ""));
  const category = escapeHtml(post.category || "");
  const imageMarkup = post.image
    ? `<a href="${getPostUrl(postId)}" aria-label="Open article: ${title}"><img src="${post.image}" alt="${title}" loading="lazy" /></a>`
    : "";

  return `
    <article class="post" id="post-${postId}" data-post-id="${postId}">
      <h3 class="post-title">${title}</h3>
      ${imageMarkup}
      <p class="post-desc">${summary.replace(/\n/g, "<br>")}</p>
      <small>${category}</small>
      <p class="post-meta">Posted by ${author} on ${postDate}</p>
      <div class="post-actions">
        <button type="button" onclick="openPostDetail('${postId}')">Read More</button>
      </div>
    </article>
  `;
}

function loadRelatedPosts(excludePostId) {
  return db
    .collection("posts")
    .orderBy("time", "desc")
    .limit(6)
    .get()
    .then((snapshot) => {
      let html = "";
      snapshot.forEach((doc) => {
        if (doc.id === excludePostId) return;
        const post = doc.data();
        html += buildPostCard(post, doc.id);
      });
      return html || '<p class="empty-state">No more posts available right now.</p>';
    })
    .catch(() => '<p class="empty-state">No more posts available right now.</p>');
}

function showPostDetail(postId) {
  isDetailView = true;
  const postsContainer = document.getElementById("posts");
  if (postsContainer) {
    postsContainer.innerHTML = '<div class="loading-state">Loading article...</div>';
  }

  db.collection("posts")
    .doc(postId)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        loadPosts();
        return;
      }

      const post = doc.data();
      const postDate = post.time ? post.time.toDate().toLocaleString() : "";
      const author = post.author || "realpesky";
      const title = escapeHtml(post.title || "");
      const description = escapeHtml(post.description || "").replace(/\n/g, "<br>");
      const category = escapeHtml(post.category || "");

      document.title = `${post.title || "Article"} | REAL PESKY`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          post.description ? post.description.substring(0, 160) : "Football news, transfer updates and match analysis from Real Pesky."
        );
      }

      loadRelatedPosts(postId).then((relatedPostsHtml) => {
        document.getElementById("posts").innerHTML = `
          <article class="post detail-post" id="post-${postId}" data-post-id="${postId}">
            <small>${category}</small>
            <h2>${title}</h2>
            ${post.image ? `<img src="${post.image}" alt="${title}" loading="eager" />` : ""}
            <p class="post-desc">${description}</p>
            <p class="post-meta">Posted by ${author} on ${postDate}</p>
            <div class="post-actions">
              <button type="button" onclick="closePostDetail()">Back to Latest Posts</button>
            </div>
          </article>

          <section class="related-posts">
            <h3>More stories</h3>
            ${relatedPostsHtml}
          </section>
        `;
      });
    })
    .catch(() => {
      loadPosts();
    });
}

function renderFeed(posts) {
  let postsHTML = "";

  posts.forEach((entry) => {
    const post = typeof entry.data === "function" ? entry.data() : entry;
    const postId = entry.id || entry.postId || entry.docId;
    const title = (post.title || "").toLowerCase();
    const desc = (post.description || "").toLowerCase();
    const matchText = searchValue.trim().toLowerCase();

    const matchesSearch =
      matchText === "" || title.includes(matchText) || desc.includes(matchText);

    if (matchesSearch && postId) {
      postsHTML += buildPostCard(post, postId);
    }
  });

  document.getElementById("posts").innerHTML = postsHTML || '<p class="empty-state">No posts found.</p>';
  document.getElementById("seeMoreBtn").style.display = "none";
}

function loadPosts(isLoadMore = false) {
  let query = db.collection("posts").orderBy("time", "desc");

  if (categoryFilter && categoryFilter.trim() !== "") {
    query = query.where("category", "==", categoryFilter.trim());
  }

  if (isLoadMore && lastVisible) {
    query = query.startAfter(lastVisible);
  }

  query = query.limit(10);

  query
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) {
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        savePostsToCache(snapshot.docs);
      }

      if (!isLoadMore) {
        renderFeed(snapshot.docs);
      } else {
        const currentPosts = document.getElementById("posts");
        const currentHtml = currentPosts.innerHTML;
        const moreHtml = snapshot.docs
          .map((doc) => {
            const post = doc.data();
            const title = (post.title || "").toLowerCase();
            const desc = (post.description || "").toLowerCase();
            const matchText = searchValue.trim().toLowerCase();
            const matchesSearch =
              matchText === "" || title.includes(matchText) || desc.includes(matchText);

            return matchesSearch ? buildPostCard(post, doc.id) : "";
          })
          .join("");

        currentPosts.innerHTML = currentHtml + moreHtml;
      }

      if (snapshot.size === 10) {
        document.getElementById("seeMoreBtn").style.display = "block";
      } else {
        document.getElementById("seeMoreBtn").style.display = "none";
      }
    })
    .catch(() => {
      document.getElementById("posts").innerHTML = '<p class="empty-state">Unable to load posts right now.</p>';
    });
}

function seeMore() {
  loadPosts(true);
}

function searchPosts() {
  searchValue = document.getElementById("searchInput").value.trim();
  loadPosts();
}

function filterCategory(category) {
  categoryFilter = category;
  loadPosts();
}

function updateScrollPostUrl() {
  if (isDetailView) return;

  const cards = [...document.querySelectorAll(".post[data-post-id]")];
  if (!cards.length) return;

  let selectedId = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const distance = Math.abs(rect.top - window.innerHeight * 0.35);

    if (rect.top <= window.innerHeight * 0.8 && rect.bottom >= 0 && distance < closestDistance) {
      closestDistance = distance;
      selectedId = card.dataset.postId;
    }
  });

  if (selectedId && selectedId !== lastScrollPostId) {
    lastScrollPostId = selectedId;
    const url = new URL(window.location.href);
    url.searchParams.set("post", selectedId);
    history.replaceState({}, "", url);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("post");

  if (postId) {
    showPostDetail(postId);
  } else {
    renderCachedPosts();
    loadPosts();
  }
});

window.addEventListener("popstate", () => {
  const postId = new URLSearchParams(window.location.search).get("post");
  if (postId) {
    showPostDetail(postId);
  } else {
    isDetailView = false;
    loadPosts();
  }
});
