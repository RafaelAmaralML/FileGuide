import os
import sys
import shutil
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_cohere import CohereEmbeddings  # type: ignore
from langchain_cohere import ChatCohere  # type: ignore
from langchain_chroma import Chroma  # type: ignore
from langchain.chains import RetrievalQA
from langchain.schema import Document
import json



project_path = 'C:\\Users\\uc201\\FileGuide\\fileguide\\c4'
userTask = 'Improve AI\'s decision-making by enhancing the evaluation function'

# Initialize loader and load documents
try:
    loader = DirectoryLoader(project_path, glob="**/*")
    docs = loader.load()
except Exception as e:
    print(f"Error loading documents: {e}")
    sys.exit(1)

# Function to map file extensions to language contexts
def get_language_and_chunk_params(doc):
    file_ext = os.path.splitext(doc.metadata['source'])[1].lower()
    language_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.java': 'java',
        '.cpp': 'cpp',
        '.cs': 'csharp',
        '.rb': 'ruby',
        '.html': 'html',
        '.css': 'css',
        '.go': 'go',
        # Add more mappings as needed
    }
    return language_map.get(file_ext, 'text')  # Default to 'text' if unrecognized

# Function to adapt chunk parameters based on document length
def get_chunk_params(doc_length):
    if doc_length < 500:
        return {"chunk_size": doc_length, "chunk_overlap": 0}
    elif doc_length < 2000:
        return {"chunk_size": 300, "chunk_overlap": 50}
    else:
        return {"chunk_size": 500, "chunk_overlap": 100}

adaptive_texts = []
for doc in docs:
    try:
        language = get_language_and_chunk_params(doc)
        params = get_chunk_params(len(doc.page_content))
        documents_splitter = RecursiveCharacterTextSplitter.from_language(language=language, **params)    
        for chunk in documents_splitter.split_documents([doc]):
            chunk_with_path = f"# File: {doc.metadata['source']}\n{chunk.page_content}"
            adaptive_texts.append(Document(page_content=chunk_with_path, metadata=doc.metadata))
    except Exception as e:
        print(f"Error processing document {doc.metadata.get('source')}: {e}")
        sys.exit(1)

# Initialize embeddings model
try:
    embeddings_model = CohereEmbeddings(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model='embed-english-v3.0')
except Exception as e:
    print(f"Error initializing embeddings model: {e}")
    sys.exit(1)

# Ensure the 'data' directory is fresh for Chroma storage
if os.path.exists('./data'):
    try:
        shutil.rmtree('./data')
    except Exception as e:
        print(f"Error removing existing 'data' directory: {e}")
        sys.exit(1)

# Initialize Chroma with error handling
try:
    vectordb = Chroma.from_documents(adaptive_texts, embedding=embeddings_model, persist_directory='./data')
except Exception as e:
    print(f"Error initializing Chroma vector database: {e}")
    sys.exit(1)

# Initialize the LLM model and RetrievalQA
try:
    llm = ChatCohere(cohere_api_key="w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV", model="command-r-plus-08-2024")

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type='stuff',
        retriever=vectordb.as_retriever(search_type="mmr"),
        verbose=True
    )
except Exception as e:
    print(f"Error initializing LLM or QA chain: {e}")
    sys.exit(1)

finalPrompt = f"""Analyze the documents i have provided and based on this specific task: {userTask}, determine the likelihood that each file will need to be modified in order to complete said task. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30% .List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations."""

finalPromptV2 = f"""
Analyze the documents I have provided and based on this specific task: {userTask}, determine the likelihood that each file will need to be modified in order to complete said task. 
Provide the output in the following format, listing each file path and associated probability of change on a new line, ordered from highest to lowest probability. 
The response should look like this: Path1 - 85% Path2 - 70% Path3 - 30%. List the files by probability in descending order, include only the file path and probability, 
and avoid any additional text or explanations.
I would also like you to analyze if the task makes sense in the context of the project. If it does, the output remains as explained above; otherwise, suggest another task for the user, 
using the format: "The task does not seem to align with the project's context. 
Suggested task: ...."
"""

# Run the query if the QA chain is available
try:
    response = qa_chain.invoke({"query": finalPromptV2, "chat_history": []})
    print(response['result'])
except Exception as e:
    print(f"Error executing query on the QA chain: {e}")
    sys.exit(1)
