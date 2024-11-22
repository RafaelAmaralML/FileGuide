import os
import sys
import shutil
import json
import glob
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter, CharacterTextSplitter
from langchain_cohere import CohereEmbeddings  # type: ignore
from langchain_cohere import ChatCohere  # type: ignore
from langchain_chroma import Chroma  # type: ignore
from langchain.chains import RetrievalQA
from langchain.schema import Document

SUPPORTED_LANGUAGES = [
    "cpp", "go", "java", "kotlin", "js", "ts", "php", "proto",
    "python", "rst", "ruby", "rust", "scala", "swift", "markdown",
    "latex", "html", "sol", "csharp", "cobol", "c", "lua", "perl",
    "haskell", "elixir", "powershell"
]

def load_documents(project_path, glob_pattern="**/*"):
    """Load all documents from the given directory."""
    all_docs = []
    for file_path in glob.glob(os.path.join(project_path, glob_pattern), recursive=True):
        if os.path.isfile(file_path):
            try:
                if file_path.endswith(".json"):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                    json_content = json.dumps(content, indent=2)
                    all_docs.append(Document(page_content=json_content, metadata={'source': file_path}))
                else:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    all_docs.append(Document(page_content=content, metadata={'source': file_path}))
            except Exception as e:
                print(f"Error loading file {file_path}: {e}")
                sys.exit(1)
    return all_docs

def get_language_and_chunk_params(file_path):
    """Determine the language and chunk parameters for a document based on file extension."""
    file_ext = os.path.splitext(file_path)[1].lower()
    language_map = {
        '.py': 'python', '.js': 'js', '.ts': 'ts', '.java': 'java',
        '.cpp': 'cpp', '.cs': 'csharp', '.rb': 'ruby', '.html': 'html',
        '.go': 'go', '.php': 'php', '.md': 'markdown', '.rst': 'rst',
        '.c': 'c', '.h': 'c', '.swift': 'swift', '.scala': 'scala',
        '.rs': 'rust', '.sol': 'sol', '.tex': 'latex', '.ps1': 'powershell',
    }
    return language_map.get(file_ext, 'text')

def get_chunk_params(doc_length):
    """Determine the chunk size and overlap based on document length."""
    if doc_length < 500:
        return {"chunk_size": doc_length, "chunk_overlap": 0}
    elif doc_length < 2000:
        return {"chunk_size": 300, "chunk_overlap": 50}
    else:
        return {"chunk_size": 500, "chunk_overlap": 100}

def process_documents(docs):
    """Split documents into adaptive chunks."""
    adaptive_texts = []
    for doc in docs:
        language = get_language_and_chunk_params(doc.metadata['source'])
        params = get_chunk_params(len(doc.page_content))
        
        try:
            if language in SUPPORTED_LANGUAGES:
                splitter = RecursiveCharacterTextSplitter.from_language(language=language, **params)
            else:
                print(f"Unsupported language '{language}' for file: {doc.metadata['source']}. Using fallback.")
                splitter = CharacterTextSplitter(**params)
            
            for chunk in splitter.split_documents([doc]):
                chunk_with_path = f"# File: {doc.metadata['source']}\n{chunk.page_content}"
                adaptive_texts.append(Document(page_content=chunk_with_path, metadata=doc.metadata))
        except Exception as e:
            print(f"Error processing document {doc.metadata['source']}: {e}")
            sys.exit(1)
    
    return adaptive_texts

def initialize_embeddings(api_key, model):
    """Initialize the Cohere embeddings model."""
    try:
        return CohereEmbeddings(cohere_api_key=api_key, model=model)
    except Exception as e:
        print(f"Error initializing embeddings model: {e}")
        sys.exit(1)

def initialize_chroma(docs, embeddings, directory='./data'):
    """Initialize the Chroma vector database."""
    if os.path.exists(directory):
        try:
            shutil.rmtree(directory)
        except Exception as e:
            print(f"Error removing existing directory '{directory}': {e}")
            sys.exit(1)
    
    try:
        return Chroma.from_documents(docs, embedding=embeddings, persist_directory=directory)
    except Exception as e:
        print(f"Error initializing Chroma vector database: {e}")
        sys.exit(1)

def initialize_qa_chain(vectordb, api_key, model):
    """Initialize the QA retrieval chain."""
    try:
        llm = ChatCohere(cohere_api_key=api_key, model=model)
        return RetrievalQA.from_chain_type(
            llm=llm,
            chain_type='stuff',
            retriever=vectordb.as_retriever(search_type="mmr"),
            verbose=True
        )
    except Exception as e:
        print(f"Error initializing LLM or QA chain: {e}")
        sys.exit(1)

def main():
    if len(sys.argv) == 3:
        project_path = sys.argv[1]
        userTask = sys.argv[2]
    else:
        project_path = 'C:\\Users\\uc201\\FileGuide\\fileguide\\Project1'
        userTask = 'I want to go to mars'

    # Load documents
    print("Loading documents...")
    docs = load_documents(project_path)
    print(f"Total documents loaded: {len(docs)}")

    # Process documents into adaptive chunks
    print("Processing documents...")
    adaptive_texts = process_documents(docs)
    print(f"Total number of chunks created: {len(adaptive_texts)}")

    # Initialize embeddings and vector database
    embeddings_model = initialize_embeddings(api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model='embed-english-v3.0')
    vectordb = initialize_chroma(adaptive_texts, embeddings_model)

    # Initialize QA chain
    qa_chain = initialize_qa_chain(vectordb, api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model="command-r-plus-08-2024")

    # Run the query
    finalPromptV2 = f"""
        Analyze the documents I have provided and based on this specific task: {userTask}, determine the likelihood that each file will need to be modified in order to complete said task. 
        Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
        The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30%. List the files by probability in descending order, include only the file path and probability, 
        and avoid any additional text or explanations.
        I would also like you to analyze if the task makes sense in the context of the project. If it does, the output remains as explained above; otherwise, suggest another task for the user, 
        using the format: "The task does not seem to align with the project's context. 
        Suggested task: ...."
    """
    try:
        response = qa_chain.invoke({"query": finalPromptV2, "chat_history": []})
        print(response['result'])
    except Exception as e:
        print(f"Error executing query on the QA chain: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
