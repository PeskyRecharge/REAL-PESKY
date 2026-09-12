function createPost() {

const title = document.getElementById("title").value.trim();
const desc = document.getElementById("desc").value.trim();
const category = document.getElementById("category").value;
const imageFile = document.getElementById("imageFile").files[0];

const btn = document.getElementById("publishBtn");

if (!title || !desc) {
    alert("Fill title and description");
    return;
}

if (!imageFile) {
    alert("Select image");
    return;
}

btn.innerText = "Publishing...";
btn.disabled = true;

// Convert image to BASE64
const reader = new FileReader();

reader.readAsDataURL(imageFile);

reader.onload = function () {

    const base64Image = reader.result;

    db.collection("posts").add({
        title: title,
        description: desc,
        category: category,
        image: base64Image,
        likes: 0,
        time: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {

        alert("Post published successfully!");

        document.getElementById("title").value = "";
        document.getElementById("desc").value = "";
        document.getElementById("imageFile").value = "";

        btn.innerText = "Publish Post";
        btn.disabled = false;

    })
    .catch(err => {

        alert("Error: " + err.message);

        btn.innerText = "Publish Post";
        btn.disabled = false;

    });

};

}

function loadPosts() {

db.collection("posts")
.orderBy("time", "desc")
.onSnapshot(snapshot => {

    let editHTML = "";
    let deleteHTML = "";

    snapshot.forEach(doc => {

        let post = doc.data();

        editHTML += `<option value="${doc.id}">${post.title}</option>`;
        deleteHTML += `<option value="${doc.id}">${post.title}</option>`;

    });

    document.getElementById("editSelect").innerHTML = editHTML;
    document.getElementById("deleteSelect").innerHTML = deleteHTML;

});

}

function updatePost() {

let id = document.getElementById("editSelect").value;

db.collection("posts").doc(id).update({
    title: document.getElementById("editTitle").value,
    description: document.getElementById("editDesc").value
})
.then(() => {
    alert("Post updated!");
});

}

function deletePost() {

let id = document.getElementById("deleteSelect").value;

if (!id) {
    alert("No post selected");
    return;
}

if (!confirm("Delete this post?")) {
    return;
}

db.collection("posts").doc(id).delete()
.then(() => {
    alert("Post deleted!");
})
.catch(err => {
    alert(err.message);
});

}loadPosts();